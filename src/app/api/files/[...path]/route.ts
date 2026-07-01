// src/app/api/files/[...path]/route.ts
// Sirve uploads validados desde almacenamiento controlado.

import { NextRequest, NextResponse } from "next/server";
import { lstat, readFile } from "fs/promises";
import path from "path";
import { getUploadStorageDir, resolveServableUploadResource, resolveUploadFilesystemCandidates } from "@/lib/uploads/uploads";

export const dynamic = "force-dynamic";

type FileServeDeps = {
    lstat: typeof lstat;
    readFile: typeof readFile;
    uploadDir: string;
};

const defaultDeps: FileServeDeps = {
    lstat,
    readFile,
    uploadDir: getUploadStorageDir(),
};

export async function handleGetFile(
    _req: Request,
    params: { path: string[] },
    deps: FileServeDeps = defaultDeps,
) {
    const resource = resolveServableUploadResource(params.path);
    if (!resource.ok) {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    try {
        const candidatePaths = deps.uploadDir === getUploadStorageDir()
            ? resolveUploadFilesystemCandidates(resource.filename)
            : [path.join(deps.uploadDir, resource.filename)];

        for (const filePath of candidatePaths) {
            try {
                const fileStats = await deps.lstat(filePath);

                if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
                    continue;
                }

                const fileBuffer = await deps.readFile(filePath);

                return new NextResponse(fileBuffer, {
                    status: 200,
                    headers: {
                        "Content-Type": resource.contentType,
                        "Cache-Control": "public, max-age=31536000, immutable",
                        "Content-Disposition": `inline; filename="${resource.filename}"`,
                        "Cross-Origin-Resource-Policy": "same-origin",
                        "X-Content-Type-Options": "nosniff",
                    },
                });
            } catch {
                continue;
            }
        }

        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    } catch {
        return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return handleGetFile(req, await params);
}
