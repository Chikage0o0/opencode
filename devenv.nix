{ pkgs, ... }:

{
  starship = {
    enable = true;
    config = {
      enable = true;
      path = ./starship.toml;
    };
  };

  packages = with pkgs; [
    git
    ripgrep
  ];

  scripts = {
    check.exec = "scripts/test-devenv-plugin.sh";
  };

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs;
    nodejs.enable = true;
    lsp.enable = true;
    bun = {
      enable = true;
      install.enable = true;
    };
  };

  enterShell = ''
    echo ""
    echo "OpenCode 配置开发环境已就绪"
    echo "当前目录：$PWD"
    echo ""
    echo "运行时版本："
    echo "  bun:  $(bun --version)"
    echo "  node: $(node --version)"
    echo ""
    echo "常用命令："
    echo "  check  运行 devenv 插件测试"
    echo ""
    echo "提示：当前环境只暴露本仓库实际可用的最小命令。"
    echo ""
  '';
}
