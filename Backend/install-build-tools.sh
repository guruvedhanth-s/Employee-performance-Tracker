#!/bin/bash

# Install build tools for Linux
# This script detects your OS and installs the necessary C++ compiler and development headers

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Installing Build Tools for Python Package Compilation${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if command -v dnf &> /dev/null; then
    # Fedora/RHEL/CentOS
    echo -e "${YELLOW}Detected: Fedora/RHEL/CentOS${NC}"
    echo -e "${YELLOW}Installing: gcc-c++, python3-devel...${NC}"
    sudo dnf install -y gcc-c++ python3-devel
    
elif command -v apt-get &> /dev/null; then
    # Ubuntu/Debian
    echo -e "${YELLOW}Detected: Ubuntu/Debian${NC}"
    echo -e "${YELLOW}Updating package list...${NC}"
    sudo apt-get update
    echo -e "${YELLOW}Installing: build-essential, python3-dev...${NC}"
    sudo apt-get install -y build-essential python3-dev
    
elif command -v brew &> /dev/null; then
    # macOS
    echo -e "${YELLOW}Detected: macOS${NC}"
    echo -e "${YELLOW}Installing Xcode Command Line Tools...${NC}"
    xcode-select --install
    
else
    echo -e "${RED}Could not detect your Linux distribution${NC}"
    echo -e "${YELLOW}Please manually run one of these commands:${NC}"
    echo ""
    echo -e "${BLUE}Fedora/RHEL/CentOS:${NC}"
    echo -e "  ${BLUE}sudo dnf install -y gcc-c++ python3-devel${NC}"
    echo ""
    echo -e "${BLUE}Ubuntu/Debian:${NC}"
    echo -e "  ${BLUE}sudo apt-get update${NC}"
    echo -e "  ${BLUE}sudo apt-get install -y build-essential python3-dev${NC}"
    echo ""
    echo -e "${BLUE}macOS:${NC}"
    echo -e "  ${BLUE}xcode-select --install${NC}"
    echo ""
    exit 1
fi

# Verify installation
echo ""
if command -v g++ &> /dev/null; then
    echo -e "${GREEN}✓ C++ compiler installed successfully!${NC}"
    g++ --version | head -1
else
    echo -e "${RED}✗ Installation may have failed or gcc-c++ is not in PATH${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Build tools are now ready!${NC}"
echo -e "${YELLOW}Run the main setup script:${NC}"
echo -e "  ${BLUE}./setup_and_run.sh${NC}"
