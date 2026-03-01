# Dotfiles Skill

Manage and understand the user's dotfiles across machines.

## Repo

- **GitHub**: `https://github.com/cwilson613/dotfiles`
- **Local clone**: `~/.dotfiles`
- **Deploy method**: GNU Stow (`make install` or `./deploy.sh`)
- **Structure**: Each top-level directory is a stow package that mirrors `$HOME`

## Packages

| Package | Contents | Symlink targets |
|---------|----------|-----------------|
| `bash` | `.bashrc`, `.bash_profile` | `~/.bashrc`, `~/.bash_profile` |
| `git` | `.gitconfig` | `~/.gitconfig` |
| `kitty` | `kitty.conf`, `tab_bar.py`, sessions, `clip2path` | `~/.config/kitty/*`, `~/.local/bin/clip2path` |
| `vim` | `.netrwhist` | `~/.netrwhist` |

## Kitty Configuration

- **Font**: JetBrains Mono 13pt
- **Theme**: VS Code dark (bg `#1e1e1e`, fg `#d4d4d4`)
- **Opacity**: 0.95
- **Tabs**: Powerline separator style, top edge
- **Remote control**: socket-only (`unix:/tmp/kitty-{kitty_pid}`)
- **Image paste**: `Ctrl+Alt+V` triggers `clip2path` (saves clipboard image to `/tmp`, sends path)
- **Text paste**: `Cmd+V` (macOS) / default paste
- **macOS**: option-as-alt, quit-when-last-window-closed
- **Custom tab bar**: `tab_bar.py` (Python plugin)
- **Sessions**: `scribe-pro.conf` / `scribe-pro.kitty.conf`

## Bash Configuration

- **Homebrew**: loaded via shellenv
- **Nix**: Determinate Systems installer, PATH added directly (homebrew bash skips `/etc/profile`)
- **KUBECONFIG**: multi-cluster merged — `~/.kube/brutus.kubeconfig:~/.kube/recro-eks.kubeconfig`
- **PATH additions**: `~/.local/bin`, `~/.lmstudio/bin`, cargo
- **Aliases**: `clod` → `claude --dangerously-skip-permissions`
- **Prompt**: custom with git branch display
- **Safety**: `set -o pipefail`

## Git Configuration

- **User**: Chris / `72043878+cwilson613@users.noreply.github.com`
- **Credential helpers**: GitHub (gh), GitLab (glab)
- **Custom hooks path**: `~/.config/git/hooks`

## Cross-Platform Notes

- Stow works identically on macOS and Linux
- `clip2path` supports both macOS (`osascript`) and Linux (`wl-paste` / `xclip`)
- Kitty config is platform-agnostic except `macos_*` directives (ignored on Linux)
- Bash config has conditional PATH additions (`[ -d ... ] &&`)

## Operations

### Deploy on a new machine
```bash
git clone https://github.com/cwilson613/dotfiles ~/.dotfiles
cd ~/.dotfiles
make install
```

### Update and sync
```bash
cd ~/.dotfiles
git pull
make restow
```

### Add changes
```bash
cd ~/.dotfiles
git add -A
git commit -m "description"
git push
```

### Check status
```bash
cd ~/.dotfiles
make status
```
