import argparse
import gc
import json
import os
import re
import sys
import traceback

import bpy


def parse_arguments():
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Batch GLB to UE5 FBX conversion")
    parser.add_argument("--jobs", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(arguments)


def safe_name(value, fallback):
    cleaned = re.sub(r"[^0-9A-Za-zА-Яа-я._-]+", "_", value or "").strip("._")
    return cleaned or fallback


def linked_images(socket, visited=None):
    if socket is None or not socket.is_linked:
        return []
    visited = visited or set()
    images = []
    for link in socket.links:
        node = link.from_node
        marker = node.as_pointer()
        if marker in visited:
            continue
        visited.add(marker)
        if node.type == "TEX_IMAGE" and node.image:
            images.append(node.image)
            continue
        for input_socket in node.inputs:
            images.extend(linked_images(input_socket, visited))
    return images


def find_principled(material):
    if not material.use_nodes or not material.node_tree:
        return None
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)


def save_textures(texture_directory):
    os.makedirs(texture_directory, exist_ok=True)
    paths = {}
    used_names = set()
    for index, image in enumerate(bpy.data.images):
        if image.type != "IMAGE" or image.name in {"Render Result", "Viewer Node"}:
            continue
        try:
            if not image.has_data:
                _ = image.pixels[0]
            base = safe_name(image.name.rsplit(".", 1)[0], f"texture_{index + 1:02d}")
            candidate = base
            suffix = 2
            while candidate.casefold() in used_names:
                candidate = f"{base}_{suffix}"
                suffix += 1
            used_names.add(candidate.casefold())
            destination = os.path.join(texture_directory, f"{candidate}.png")
            image.filepath_raw = destination
            image.file_format = "PNG"
            image.save()
            if image.packed_file:
                image.unpack(method="REMOVE")
            image.filepath_raw = destination
            image.filepath = destination
            image.source = "FILE"
            image.reload()
            paths[image.as_pointer()] = destination
        except Exception as error:
            print(f"[texture warning] {image.name}: {error}")
    return paths


def material_manifest(model_directory, texture_paths):
    roles = {
        "Base Color": "base_color",
        "Metallic": "metallic",
        "Roughness": "roughness",
        "Normal": "normal",
        "Alpha": "opacity",
        "Emission Color": "emissive",
        "Emission": "emissive",
    }
    result = []
    for material in bpy.data.materials:
        record = {"name": material.name, "textures": []}
        principled = find_principled(material)
        if principled:
            seen = set()
            for socket_name, role in roles.items():
                socket = principled.inputs.get(socket_name)
                for image in linked_images(socket):
                    image_path = texture_paths.get(image.as_pointer())
                    if not image_path or (role, image_path) in seen:
                        continue
                    seen.add((role, image_path))
                    record["textures"].append(
                        {
                            "role": role,
                            "image": image.name,
                            "path": os.path.relpath(image_path, model_directory).replace("\\", "/"),
                            "colorSpace": image.colorspace_settings.name,
                        }
                    )
        result.append(record)
    return result


def convert(job):
    source = os.path.abspath(job["source"])
    destination = os.path.abspath(job["output"])
    texture_directory = os.path.abspath(job["textureDir"])
    material_file = os.path.abspath(job["materialManifest"])
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    os.makedirs(os.path.dirname(material_file), exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.import_scene.gltf(filepath=source)

    texture_paths = save_textures(texture_directory)
    model_directory = os.path.dirname(destination)
    materials = material_manifest(model_directory, texture_paths)
    with open(material_file, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "source": job.get("sourcePath", source),
                "typeIds": job.get("typeIds", []),
                "name": job.get("name", ""),
                "materials": materials,
            },
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")

    bpy.ops.export_scene.fbx(
        filepath=destination,
        check_existing=False,
        use_selection=False,
        global_scale=float(job.get("globalScale", 1.0)),
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_UNITS",
        bake_space_transform=False,
        object_types={"EMPTY", "MESH", "ARMATURE"},
        use_mesh_modifiers=True,
        mesh_smooth_type="FACE",
        use_triangles=True,
        use_tspace=True,
        use_custom_props=False,
        add_leaf_bones=False,
        path_mode="COPY",
        embed_textures=True,
        axis_forward="-Y",
        axis_up="Z",
    )

    mesh_count = sum(1 for value in bpy.data.objects if value.type == "MESH")
    return {
        "source": source,
        "output": destination,
        "status": "ready",
        "meshes": mesh_count,
        "materials": len(bpy.data.materials),
        "textures": len(texture_paths),
        "error": None,
    }


def main():
    options = parse_arguments()
    with open(options.jobs, "r", encoding="utf-8") as handle:
        jobs = json.load(handle)
    reports = []
    for index, job in enumerate(jobs, start=1):
        print(f"\n[{index}/{len(jobs)}] {job.get('name') or job['source']}")
        try:
            report = convert(job)
            reports.append(report)
            print(
                f"[ready] meshes={report['meshes']} materials={report['materials']} "
                f"textures={report['textures']} -> {report['output']}"
            )
        except Exception as error:
            traceback.print_exc()
            reports.append(
                {
                    "source": os.path.abspath(job["source"]),
                    "output": os.path.abspath(job["output"]),
                    "status": "failed",
                    "error": str(error),
                }
            )
        finally:
            with open(options.report, "w", encoding="utf-8") as handle:
                json.dump(reports, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            gc.collect()
    if any(report["status"] == "failed" for report in reports):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
