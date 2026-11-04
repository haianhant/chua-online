#!/usr/bin/env python3
"""Generate a simple traditional temple (boxes: platform, hall, 2 roofs,
pillars, door, golden finial) as a valid binary glTF (.glb).

Each box is one mesh primitive with POSITION + NORMAL + indices.
No external dependencies.
"""
import json, struct, sys
from pathlib import Path

def box(cx, cy, cz, sx, sy, sz, color):
    """Return (positions, normals, indices) for an axis-aligned box."""
    x, y, z = sx / 2, sy / 2, sz / 2
    # 6 faces, 4 verts each, outward normals
    faces = [
        # +x, -x, +y, -y, +z, -z  (corner order CCW seen from outside)
        ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1), (1, 0, 0)),
        ((-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1), (-1, 0, 0)),
        ((-1, 1, -1), (1, 1, -1), (1, 1, 1), (-1, 1, 1), (0, 1, 0)),
        ((-1, -1, 1), (1, -1, 1), (1, -1, -1), (-1, -1, -1), (0, -1, 0)),
        ((-1, -1, 1), (-1, 1, 1), (1, 1, 1), (1, -1, 1), (0, 0, 1)),
        ((1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, -1), (0, 0, -1)),
    ]
    pos, nor, idx = [], [], []
    base = 0
    for corners in faces:
        n = corners[4]
        for c in corners[:4]:
            pos.extend([cx + c[0] * x, cy + c[1] * y, cz + c[2] * z])
            nor.extend(n)
        idx.extend([base, base + 1, base + 2, base, base + 2, base + 3])
        base += 4
    return pos, nor, idx, color

STONE = (0.42, 0.40, 0.46)
WOOD = (0.48, 0.29, 0.17)
WALL = (0.78, 0.68, 0.52)
ROOF = (0.62, 0.20, 0.16)
GOLD = (0.83, 0.69, 0.22)
DARK = (0.15, 0.10, 0.08)

parts = [
    box(0, 0.25, 0, 6.0, 0.5, 4.0, STONE),      # platform
    box(0, 1.45, 0, 4.2, 2.4, 3.0, WALL),       # main hall
    box(0, 1.45, 1.55, 1.4, 2.0, 0.15, DARK),   # door (front, +z)
    box(-1.9, 1.45, 1.45, 0.25, 2.4, 0.25, WOOD),  # pillars
    box(1.9, 1.45, 1.45, 0.25, 2.4, 0.25, WOOD),
    box(-1.9, 1.45, -1.45, 0.25, 2.4, 0.25, WOOD),
    box(1.9, 1.45, -1.45, 0.25, 2.4, 0.25, WOOD),
    box(0, 2.85, 0, 5.4, 0.35, 4.2, ROOF),      # lower roof
    box(0, 3.55, 0, 3.0, 1.05, 2.2, WALL),      # upper hall
    box(0, 4.25, 0, 4.2, 0.35, 3.2, ROOF),      # upper roof
    box(0, 4.75, 0, 0.35, 0.65, 0.35, GOLD),    # finial
    box(0, 5.15, 0, 0.18, 0.25, 0.18, GOLD),
]

# Build one binary buffer, 4-byte aligned views
binary = bytearray()
buffer_views, accessors, meshes, materials, mat_index = [], [], [], [], {}
nodes = []

def align4(n):
    return (n + 3) & ~3

for pos, nor, idx, color in parts:
    if color not in mat_index:
        mat_index[color] = len(materials)
        materials.append({
            "pbrMetallicRoughness": {
                "baseColorFactor": [color[0], color[1], color[2], 1.0],
                "metallicFactor": 0.0, "roughnessFactor": 0.85,
            }
        })
    mi = mat_index[color]
    # POSITION
    while len(binary) % 4: binary.append(0)
    p_off = len(binary)
    binary.extend(struct.pack(f"<{len(pos)}f", *pos))
    # NORMAL
    while len(binary) % 4: binary.append(0)
    n_off = len(binary)
    binary.extend(struct.pack(f"<{len(nor)}f", *nor))
    # INDEX (uint16, padded to 4)
    while len(binary) % 4: binary.append(0)
    i_off = len(binary)
    binary.extend(struct.pack(f"<{len(idx)}H", *idx))
    while len(binary) % 4: binary.append(0)

    def view(off, length):
        buffer_views.append({"buffer": 0, "byteOffset": off, "byteLength": length})
        return len(buffer_views) - 1

    p_view = view(p_off, len(pos) * 4)
    n_view = view(n_off, len(nor) * 4)
    i_view = view(i_off, len(idx) * 2)
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    p_acc = len(accessors); accessors.append({
        "bufferView": p_view, "componentType": 5126, "count": len(xs), "type": "VEC3",
        "min": [min(xs), min(ys), min(zs)], "max": [max(xs), max(ys), max(zs)],
    })
    n_acc = len(accessors); accessors.append({
        "bufferView": n_view, "componentType": 5126, "count": len(xs), "type": "VEC3",
    })
    i_acc = len(accessors); accessors.append({
        "bufferView": i_view, "componentType": 5123, "count": len(idx), "type": "SCALAR",
    })
    meshes.append({"primitives": [{
        "attributes": {"POSITION": p_acc, "NORMAL": n_acc},
        "indices": i_acc, "material": mi,
    }]})
    nodes.append({"mesh": len(meshes) - 1})

gltf = {
    "asset": {"version": "2.0", "generator": "make_temple_glb.py"},
    "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}],
    "nodes": nodes, "meshes": meshes, "materials": materials,
    "accessors": accessors, "bufferViews": buffer_views,
    "buffers": [{"byteLength": len(binary)}],
}
json_chunk = json.dumps(gltf, separators=(",", ":")).encode()
while len(json_chunk) % 4: json_chunk += b" "
out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(json_chunk) + 8 + len(binary))
out += struct.pack("<II", len(json_chunk), 0x4E4F534A) + json_chunk
out += struct.pack("<II", len(binary), 0x004E4942) + bytes(binary)
out_path = Path(sys.argv[1])
out_path.write_bytes(out)
print(f"Wrote {out_path} ({len(out)} bytes, {len(parts)} parts, {len(materials)} materials)")
