#!/usr/bin/env bash
set -euo pipefail

# OpenClaw Community Edition Installation Script for Linux/macOS
# Version: 1.0.0
# Author: OpenClaw Community

# Configuration
INSTALL_PATH="${OPENCLAW_INSTALL_PATH:-$HOME/.openclaw}"
SKIP_OLLAMA="${SKIP_OLLAMA:-false}"
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"

# Colors
COLOR_RESET='\033[0m'
COLOR_HEADER='\033[1;36m'
COLOR_SUCCESS='\033[1;32m'
COLOR_WARNING='\033[1;33m'
COLOR_ERROR='\033[1;31m'
COLOR_INFO='\033[0;37m'

# Helper functions
print_header() {
    echo ""
    echo -e "${COLOR_HEADER}══════════════════════════════════════════════════════${COLOR_RESET}"
    echo -e "${COLOR_HEADER}  $1${COLOR_RESET}"
    echo -e "${COLOR_HEADER}══════════════════════════════════════════════════════${COLOR_RESET}"
    echo ""
}

print_step() {
    echo -e "${COLOR_INFO}▶ $1${COLOR_RESET}"
}

print_success() {
    echo -e "${COLOR_SUCCESS}✓ $1${COLOR_RESET}"
}

print_warning() {
    echo -e "${COLOR_WARNING}⚠ $1${COLOR_RESET}"
}

print_error() {
    echo -e "${COLOR_ERROR}✗ $1${COLOR_RESET}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_node_version() {
    if ! command_exists node; then
        return 1
    fi
    
    local node_version
    node_version=$(node --version | sed 's/v//' | cut -d. -f1)
    
    if [ "$node_version" -lt 18 ]; then
        return 1
    fi
    
    return 0
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$NON_INTERACTIVE" = "true" ]; then
        [ "$default" = "y" ] && return 0 || return 1
    fi
    
    local answer
    if [ "$default" = "y" ]; then
        read -r -p "$prompt (Y/n): " answer
        answer=${answer:-y}
    else
        read -r -p "$prompt (y/N): " answer
        answer=${answer:-n}
    fi
    
    [[ "$answer" =~ ^[Yy]$ ]]
}

install_prerequisite() {
    local name="$1"
    local command="$2"
    local install_info="$3"
    
    print_step "Checking $name..."
    
    if command_exists "$command"; then
        print_success "$name is already installed"
        return 0
    fi
    
    print_warning "$name is not installed"
    
    if [ "$NON_INTERACTIVE" = "true" ]; then
        print_error "Cannot install $name in non-interactive mode"
        echo -e "${COLOR_INFO}Please install $name: $install_info${COLOR_RESET}"
        return 1
    fi
    
    echo -e "${COLOR_INFO}Installation instructions: $install_info${COLOR_RESET}"
    
    if ask_yes_no "Have you installed $name?"; then
        if command_exists "$command"; then
            print_success "$name is now available"
            return 0
        else
            print_error "$name still not found in PATH"
            return 1
        fi
    fi
    
    return 1
}

install_pnpm() {
    print_step "Installing pnpm package manager..."
    
    if npm install -g pnpm; then
        print_success "pnpm installed successfully"
        return 0
    else
        print_error "Failed to install pnpm"
        return 1
    fi
}

install_openclaw() {
    print_header "Installing OpenClaw Community Edition"
    
    print_step "Installation path: $INSTALL_PATH"
    
    if [ -d "$INSTALL_PATH" ]; then
        print_warning "Installation directory already exists: $INSTALL_PATH"
        
        if ask_yes_no "Do you want to remove it and reinstall?"; then
            rm -rf "$INSTALL_PATH"
            print_success "Removed existing installation"
        else
            print_info "Installation cancelled"
            exit 0
        fi
    fi
    
    print_step "Cloning OpenClaw CE from GitHub..."
    
    if git clone --depth 1 https://github.com/ssfdre38/openclaw-community-edition.git "$INSTALL_PATH"; then
        print_success "Repository cloned successfully"
    else
        print_error "Failed to clone repository"
        exit 1
    fi
    
    cd "$INSTALL_PATH" || exit 1
    
    print_step "Installing dependencies with pnpm..."
    if pnpm install; then
        print_success "Dependencies installed"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
    
    print_step "Building OpenClaw CE..."
    if pnpm run build; then
        print_success "Build completed"
    else
        print_error "Build failed"
        exit 1
    fi
    
    cd - >/dev/null || exit 1
}

install_ollama_ce() {
    print_header "Installing Ollama Community Edition"
    
    local ollama_path="$INSTALL_PATH/.ollama-ce"
    
    print_step "Ollama CE will be installed to: $ollama_path"
    
    if [ -d "$ollama_path" ]; then
        print_warning "Ollama CE directory already exists"
        
        if ask_yes_no "Do you want to update it?"; then
            cd "$ollama_path" || return 1
            git pull origin community-edition
            cd - >/dev/null || return 1
            print_success "Ollama CE updated"
        else
            print_info "Skipping Ollama CE installation"
            return 0
        fi
    else
        print_step "Cloning Ollama CE from GitHub..."
        
        if git clone --depth 1 --branch community-edition https://github.com/ssfdre38/ollama.git "$ollama_path"; then
            print_success "Ollama CE cloned"
        else
            print_error "Failed to clone Ollama CE"
            return 1
        fi
    fi
    
    cd "$ollama_path" || return 1
    
    print_step "Building Ollama CE..."
    print_warning "This may take several minutes..."
    
    # Check if Go is installed
    if ! command_exists go; then
        print_error "Go is required to build Ollama CE"
        echo -e "${COLOR_INFO}Please install Go from: https://go.dev/dl/${COLOR_RESET}"
        cd - >/dev/null || return 1
        return 1
    fi
    
    # Build Ollama
    if go generate ./... && go build .; then
        print_success "Ollama CE built successfully"
        echo -e "${COLOR_INFO}Ollama CE executable: $ollama_path/ollama${COLOR_RESET}"
    else
        print_error "Failed to build Ollama CE"
        cd - >/dev/null || return 1
        return 1
    fi
    
    cd - >/dev/null || return 1
}

initialize_configuration() {
    print_header "Setting Up Configuration"
    
    local config_path="$INSTALL_PATH/.env"
    local example_path="$INSTALL_PATH/.env.example"
    
    if [ -f "$config_path" ]; then
        print_warning "Configuration file already exists: $config_path"
        return
    fi
    
    if [ -f "$example_path" ]; then
        print_step "Creating configuration from template..."
        cp "$example_path" "$config_path"
        print_success "Configuration file created"
        echo -e "${COLOR_INFO}Please edit $config_path to customize your settings${COLOR_RESET}"
    else
        print_warning "No .env.example found, skipping configuration setup"
    fi
}

show_next_steps() {
    print_header "Installation Complete!"
    
    echo -e "${COLOR_SUCCESS}OpenClaw CE has been installed to:${COLOR_RESET}"
    echo -e "${COLOR_INFO}  $INSTALL_PATH${COLOR_RESET}"
    echo ""
    
    echo -e "${COLOR_HEADER}Next steps:${COLOR_RESET}"
    echo -e "${COLOR_INFO}  1. Configure your settings:${COLOR_RESET}"
    echo -e "${COLOR_INFO}     Edit: $INSTALL_PATH/.env${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_INFO}  2. Run the interactive onboarding:${COLOR_RESET}"
    echo -e "${COLOR_INFO}     cd $INSTALL_PATH${COLOR_RESET}"
    echo -e "${COLOR_INFO}     openclaw onboard${COLOR_RESET}"
    echo ""
    echo -e "${COLOR_INFO}  3. Start OpenClaw Gateway:${COLOR_RESET}"
    echo -e "${COLOR_INFO}     openclaw gateway${COLOR_RESET}"
    echo ""
    
    if [ -f "$INSTALL_PATH/.ollama-ce/ollama" ]; then
        echo -e "${COLOR_INFO}  3. Start Ollama CE (optional):${COLOR_RESET}"
        echo -e "${COLOR_INFO}     $INSTALL_PATH/.ollama-ce/ollama serve${COLOR_RESET}"
        echo ""
    fi
    
    echo -e "${COLOR_HEADER}For more information, visit:${COLOR_RESET}"
    echo -e "${COLOR_INFO}  https://openclawce.com${COLOR_RESET}"
    echo -e "${COLOR_INFO}  https://github.com/ssfdre38/openclaw-community-edition${COLOR_RESET}"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-ollama)
            SKIP_OLLAMA=true
            shift
            ;;
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --install-path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        --help)
            echo "OpenClaw Community Edition Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-ollama          Skip Ollama CE installation"
            echo "  --non-interactive      Run in non-interactive mode"
            echo "  --install-path PATH    Custom installation path (default: ~/.openclaw)"
            echo "  --help                 Show this help message"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main installation flow
main() {
    print_header "OpenClaw Community Edition Installer"
    
    echo -e "${COLOR_INFO}This script will install OpenClaw CE on your system.${COLOR_RESET}"
    echo ""
    
    # Check prerequisites
    print_header "Checking Prerequisites"
    
    local can_proceed=true
    
    # Check Git
    if ! install_prerequisite "Git" "git" "https://git-scm.com/downloads"; then
        can_proceed=false
    fi
    
    # Check Node.js
    print_step "Checking Node.js (v18+)..."
    if check_node_version; then
        print_success "Node.js v18+ is installed"
    else
        print_warning "Node.js v18+ is required"
        
        if [ "$(uname)" = "Darwin" ]; then
            echo -e "${COLOR_INFO}Install with: brew install node${COLOR_RESET}"
        else
            echo -e "${COLOR_INFO}Install from: https://nodejs.org/${COLOR_RESET}"
        fi
        
        can_proceed=false
    fi
    
    if [ "$can_proceed" = false ]; then
        print_error "Please install missing prerequisites and run this script again."
        exit 1
    fi
    
    # Check/Install pnpm
    if ! command_exists pnpm; then
        if ! install_pnpm; then
            print_error "pnpm installation failed"
            exit 1
        fi
    else
        print_success "pnpm is already installed"
    fi
    
    # Install OpenClaw
    install_openclaw
    
    # Ask about Ollama CE
    if [ "$SKIP_OLLAMA" != "true" ]; then
        echo ""
        if ask_yes_no "Would you like to install Ollama Community Edition?" "y"; then
            install_ollama_ce
        else
            print_info "Skipping Ollama CE installation"
        fi
    fi
    
    # Initialize configuration
    initialize_configuration
    
    # Show next steps
    show_next_steps
}

# Run main function
main
