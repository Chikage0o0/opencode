import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { Plugin } from "@opencode-ai/plugin"
import type { FilePart, Part } from "@opencode-ai/sdk"

const marker = "[Image path bridge]"
const imageExtensions = new Set([
  ".bmp",
  ".gif",
  ".heic",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
])

const mimeExtensions: Record<string, string> = {
  "image/bmp": ".bmp",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/tiff": ".tiff",
  "image/webp": ".webp",
}

function isImage(part: Part): part is FilePart {
  if (part.type !== "file") return false
  if (part.mime.startsWith("image/")) return true
  return imageExtensions.has(extname(part.filename ?? "").toLowerCase())
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_") || "image"
}

function readAttachment(part: FilePart): Buffer | undefined {
  const dataUrl = /^data:[^;,]+;base64,([\s\S]+)$/.exec(part.url)
  if (dataUrl) return Buffer.from(dataUrl[1], "base64")
  if (part.url.startsWith("file:")) return readFileSync(fileURLToPath(part.url))
  return undefined
}

function saveAttachment(
  directory: string,
  sessionID: string,
  part: FilePart,
): string | undefined {
  const data = readAttachment(part)
  if (!data) return undefined

  const imageRoot = resolve(
    directory,
    ".opencode",
    "images",
    sanitizeSegment(sessionID),
  )
  mkdirSync(imageRoot, { recursive: true })

  const opencodeIgnore = resolve(directory, ".opencode", ".gitignore")
  if (!existsSync(opencodeIgnore)) {
    try {
      writeFileSync(opencodeIgnore, "*\n", { flag: "wx" })
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
    }
  }

  const originalName = basename(part.filename ?? "image")
  const originalExtension = extname(originalName).toLowerCase()
  const extension =
    imageExtensions.has(originalExtension)
      ? originalExtension
      : (mimeExtensions[part.mime] ?? ".png")
  const stem = sanitizeSegment(
    originalExtension
      ? originalName.slice(0, -originalExtension.length)
      : originalName,
  )
  const hash = createHash("sha1").update(data).digest("hex").slice(0, 8)
  const imagePath = resolve(imageRoot, `${stem}-${hash}${extension}`)

  if (!existsSync(imagePath)) {
    try {
      writeFileSync(imagePath, data, { flag: "wx" })
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
    }
  }

  return imagePath
}

export const ImagePathBridgePlugin: Plugin = async ({ client, directory }) => ({
  "experimental.chat.messages.transform": async (_input, output) => {
    for (const message of output.messages) {
      if (message.info.role !== "user") continue

      const imageParts = message.parts.filter(isImage)
      if (imageParts.length === 0) continue

      const paths: string[] = []
      for (const part of imageParts) {
        try {
          const path = saveAttachment(directory, message.info.sessionID, part)
          if (path) paths.push(path)
        } catch (error) {
          await client.app
            .log({
              body: {
                service: "image-path-bridge",
                level: "warn",
                message: "保存图片附件失败",
                extra: {
                  error: String(error),
                  filename: part.filename,
                },
              },
            })
            .catch(() => undefined)
        }
      }

      if (paths.length === 0) continue

      const pathNotice = [
        marker,
        ...paths.map((path) => `- ${path}`),
        "When delegating image-dependent work, include the exact absolute path(s) above in the subagent prompt. The original image attachment remains available to the main agent.",
      ].join("\n")

      const textPart = message.parts.find(
        (part) => part.type === "text" && !part.text.includes(marker),
      )
      if (textPart?.type === "text") {
        textPart.text = `${textPart.text}\n\n${pathNotice}`
        continue
      }

      const source = imageParts[0]
      message.parts.push({
        id: `${source.id}-image-path-bridge`,
        sessionID: source.sessionID,
        messageID: source.messageID,
        type: "text",
        text: pathNotice,
        synthetic: true,
      })
    }
  },
})
