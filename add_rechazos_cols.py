import os, re

files_js = {
    "Influenza": (r"c:\Antigravity IDE\WEB DEIS\Influenza_Web\autoconsulta.js", "INFLUENZA"),
    "Covid":     (r"c:\Antigravity IDE\WEB DEIS\Covid_Web\autoconsulta.js", "COVID-19"),
    "VRS":       (r"c:\Antigravity IDE\WEB DEIS\VRS\autoconsulta.js", "VRS"),
    "VPH":       (r"c:\Antigravity IDE\WEB DEIS\VPH_Web\autoconsulta.js", "VPH")
}

for vaccine, (path, vname) in files_js.items():
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update the header creation block
    # We look for where it creates the vaccine column (e.g., 'INFLUENZA')
    # and we insert the creation of the two new columns if rechazoColIdx !== -1
    
    # Example snippet to match:
    # sheet[headerCellRef].s = { ... };
    # let siCount = 0;
    
    header_pattern = re.compile(
        r"(sheet\[headerCellRef\]\.s = \{[\s\S]*?\};\s*)(let siCount = 0;)"
    )
    
    new_header_code = r'''\1
        let colRechazosSiNo = -1;
        let colCausalText = -1;
        if (rechazoColIdx !== -1) {
            colRechazosSiNo = newColIdx + 1;
            colCausalText = newColIdx + 2;
            
            const headerRechazosRef = XLSX.utils.encode_cell({r: range.s.r, c: colRechazosSiNo});
            sheet[headerRechazosRef] = { t: 's', v: 'RECHAZOS' };
            sheet[headerRechazosRef].s = sheet[headerCellRef].s;

            const headerCausalRef = XLSX.utils.encode_cell({r: range.s.r, c: colCausalText});
            sheet[headerCausalRef] = { t: 's', v: 'Causal de Rechazo' };
            sheet[headerCausalRef].s = sheet[headerCellRef].s;
        }

        \2'''
    
    if "colRechazosSiNo =" not in content:
        content = header_pattern.sub(new_header_code, content, count=1)
    
    # 2. Update the row processing block
    # Escribir celda resultado
    # sheet[XLSX.utils.encode_cell({r: currentRow, c: newColIdx})] = { t: 's', v: result };
    
    row_pattern = re.compile(
        r"(// Escribir celda resultado\s*sheet\[XLSX\.utils\.encode_cell\(\{r: currentRow, c: newColIdx\}\)\] = \{ t: 's', v: result \};)"
    )
    
    new_row_code = r'''\1
                    
                    if (rechazoColIdx !== -1) {
                        let originalCausalText = '';
                        const cellRechazoRow = sheet[XLSX.utils.encode_cell({r: currentRow, c: rechazoColIdx})];
                        if (cellRechazoRow && cellRechazoRow.v) {
                            originalCausalText = String(cellRechazoRow.v).trim();
                        }
                        
                        let isRechazo = 'NO';
                        if (originalCausalText !== '') {
                            isRechazo = 'SI';
                        }
                        
                        // Solo llenamos texto si hay, sino en blanco. "SI/NO segun corresponda"
                        sheet[XLSX.utils.encode_cell({r: currentRow, c: colRechazosSiNo})] = { t: 's', v: isRechazo };
                        sheet[XLSX.utils.encode_cell({r: currentRow, c: colCausalText})] = { t: 's', v: originalCausalText };
                    }'''
                    
    if "colRechazosSiNo)" not in content:
        content = row_pattern.sub(new_row_code, content, count=1)
        
    # 3. Update the range end
    # range.e.c = newColIdx;
    
    range_pattern = re.compile(
        r"(range\.e\.c = )newColIdx;"
    )
    
    new_range_code = r"\1(rechazoColIdx !== -1) ? colCausalText : newColIdx;"
    if "? colCausalText : newColIdx;" not in content:
        content = range_pattern.sub(new_range_code, content, count=1)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Updated {vaccine} Excel export to add RECHAZOS columns")
