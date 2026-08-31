import os, re

folders = [
    r"c:\Antigravity IDE\WEB DEIS\Influenza_Web",
    r"c:\Antigravity IDE\WEB DEIS\Covid_Web",
    r"c:\Antigravity IDE\WEB DEIS\VRS",
    r"c:\Antigravity IDE\WEB DEIS\VPH_Web"
]

def fix_tooltip(script_path):
    if not os.path.exists(script_path):
        return
    with open(script_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find renderTimeSeriesChart
    # We will just replace the tooltip block inside timeSeriesChart.
    # It's tricky to use regex for the whole block, so we'll look for:
    # datalabels: { display: false },
    # tooltip: {
    #     callbacks: {
    #         afterTitle: ...
    
    tooltip_pattern = re.compile(
        r"(datalabels:\s*\{\s*display:\s*false\s*\},\s*tooltip:\s*\{)(\s*callbacks:)"
    )
    
    new_tooltip_code = r"\1\n                    backgroundColor: 'rgba(255, 255, 255, 0.98)',\n                    titleColor: '#1e293b',\n                    bodyColor: '#334155',\n                    borderColor: 'rgba(15, 105, 180, 0.25)',\n                    borderWidth: 1,\n                    padding: 12,\n                    boxPadding: 6,\n                    usePointStyle: true,\2"
    
    if "backgroundColor: 'rgba(255, 255, 255, 0.98)'" not in content:
        content = tooltip_pattern.sub(new_tooltip_code, content)
    
    # Now append the mouseout logic at the end of renderTimeSeriesChart
    # Find:
    #     charts.trend = new Chart(ctx, { ... });
    # }
    # function renderComparativeMonthlyChart
    
    end_pattern = re.compile(
        r"(\}\s*\)\s*;\s*\n)(\}\s*\n+function renderComparativeMonthlyChart)"
    )
    
    fix_code = r"""\1
    const canvasEl = document.getElementById('timeSeriesChart');
    if (canvasEl && !canvasEl.dataset.mouseoutAttached) {
        canvasEl.addEventListener('mouseout', function() {
            if (charts.trend) {
                charts.trend.tooltip.setActiveElements([], {x: 0, y: 0});
                charts.trend.update();
            }
        });
        canvasEl.dataset.mouseoutAttached = 'true';
    }
\2"""
    
    if "dataset.mouseoutAttached" not in content:
        content = end_pattern.sub(fix_code, content)
        
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed tooltip in {script_path}")

for f in folders:
    fix_tooltip(os.path.join(f, "script.js"))
