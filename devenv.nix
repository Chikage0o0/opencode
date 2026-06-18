{ pkgs, ... }:

{
  env.STARSHIP_CONFIG = "${./starship.toml}";
  packages = with pkgs; [
    git
    ripgrep
    starship
  ];

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
  '';
}
