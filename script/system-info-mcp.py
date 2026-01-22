# /// script
# dependencies = [
#   "mcp",
# ]
# ///


from mcp.server.fastmcp import FastMCP
import platform
import os

# 创建 MCP 实例
mcp = FastMCP("SystemInfo")


@mcp.tool()
def get_system_info() -> str:
    """获取当前系统的详细信息，包括 OS 类型、内核版本和发行版。"""
    system = platform.system()
    release = platform.release()

    distro = "Unknown"
    if system == "Linux":
        try:
            if os.path.exists("/etc/os-release"):
                with open("/etc/os-release", "r") as f:
                    lines = f.readlines()
                    distro = next(
                        (
                            line.split("=")[1].strip().strip('"')
                            for line in lines
                            if line.startswith("ID=")
                        ),
                        "Unknown",
                    )
            system = f"Linux ({distro})"
        except Exception:
            pass

    return f"操作系统: {system}\n内核版本: {release}\n"


if __name__ == "__main__":
    mcp.run()
