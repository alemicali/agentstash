class Agentstash < Formula
  desc "Encrypted incremental backups for AI coding agents"
  homepage "https://agentstash.io"
  url "https://registry.npmjs.org/agentstash/-/agentstash-0.2.1.tgz"
  sha256 "c22aff09f5955be2acebd50e71fba1a95452e96165646760045c879f0f82c4b0"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def post_install
    ohai "Run `agentstash setup` to configure your first backup"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/agentstash --version")
  end
end
