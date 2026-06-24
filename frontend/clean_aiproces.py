import sys

def main():
    with open('src/AiProces.jsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # We will build the new file line by line
    new_lines = []
    
    # Flags to skip blocks
    skip_logo = False
    skip_dash = False
    skip_css = False
    skip_style_tag = False
    
    for i, line in enumerate(lines):
        # 1. Imports
        if "import { useAuth } from './AuthContext';" in line:
            new_lines.append("import { useAuth } from './components/auth/AuthContext.jsx';\n")
            continue
        if "import MacroprocessDiagram from \"./MacroprocessDiagram.jsx\";" in line:
            new_lines.append("import MacroprocessDiagram from \"./components/diagram/MacroprocessDiagram.jsx\";\n")
            new_lines.append("import Logo from \"./components/shared/Logo.jsx\";\n")
            new_lines.append("import Dashboard from \"./components/dashboard/Dashboard.jsx\";\n")
            new_lines.append("import './styles/main.css';\n")
            continue
            
        # 2. Skip Logo (around line 1042-1044)
        if "function Logo({ size = 34 }) {" in line:
            skip_logo = True
        if skip_logo:
            if line.strip() == "}":
                skip_logo = False
            continue
            
        # 3. Skip Dashboard (around line 1049-1369)
        if "function Dashboard({ macroprocesses" in line:
            skip_dash = True
        if skip_dash:
            if line.strip() == "}" and "export default function App" in lines[i+5] if i+5 < len(lines) else False:
                # We need to find the actual end of Dashboard. It's right before App.
                pass
            if line.startswith("export default function App() {"):
                skip_dash = False
                # fall through to append App
            else:
                continue
                
        # 4. Skip <style>{CSS}</style>
        if "<style>{CSS}</style>" in line:
            continue
            
        # 5. Skip CSS string
        if "const CSS = `" in line:
            skip_css = True
            
        if skip_css:
            if line.startswith("`;"):
                skip_css = False
            continue
            
        new_lines.append(line)

    with open('src/AiProces.jsx', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

if __name__ == '__main__':
    main()
