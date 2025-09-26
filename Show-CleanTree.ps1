# Save this as Show-CleanTree.ps1
param(
    [string]$ProjectPath = ".",
    [int]$MaxDepth = 8
)

$excludePatterns = @(
    # Dependencies
    'node_modules', 'android', 'ios', 'build', 'dist', '.vscode', '.idea',
    
    # Build outputs
    'dist', 'build', '.expo', '.next',
    
    # Caches
    '.cache', '.temp', 'tmp', '.turbo',
    
    # Version control
    '.git', '.svn',
    
    # Testing
    'coverage', '.nyc_output',
    
    # Logs and temps
    '*.log', '*.tmp', '.DS_Store', 'Thumbs.db',
    
    # Maps and compiled files
    '*.map', '*.min.js', '*.min.css'
)

function Show-Tree {
    param($Path, $Prefix = "", $Depth = 0)
    
    if ($Depth -gt $MaxDepth) { return }
    
    $items = Get-ChildItem -Path $Path -Force | Where-Object {
        $name = $_.Name
        -not ($excludePatterns | Where-Object { $name -like $_ })
    } | Sort-Object @{Expression={$_.PSIsContainer}; Descending=$true}, Name
    
    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $items.Count - 1)
        $currentPrefix = if ($isLast) { "`-- " } else { "|-- " }
        $nextPrefix = if ($isLast) { "    " } else { "|   " }
        
        $color = if ($item.PSIsContainer) { "Cyan" } else { "White" }
        Write-Host "$Prefix$currentPrefix$($item.Name)" -ForegroundColor $color
        
        if ($item.PSIsContainer) {
            Show-Tree -Path $item.FullName -Prefix "$Prefix$nextPrefix" -Depth ($Depth + 1)
        }
    }
}

Write-Host "Project Structure for: $(Resolve-Path $ProjectPath)" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Green
Show-Tree -Path $ProjectPath