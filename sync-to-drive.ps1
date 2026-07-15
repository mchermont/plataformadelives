# Sincroniza o código-fonte para a pasta espelho no Google Drive
# (exclui node_modules, .next e arquivos locais de ambiente)
robocopy "C:\dev\plataforma-lives" "G:\Meu Drive\JOBS\Plataforma de lives" `
  /MIR /XD node_modules .next /XF desktop.ini .env.local sync-to-drive.ps1 ONDE-ESTA-O-CODIGO.md /NFL /NDL
if ($LASTEXITCODE -le 7) {
  Write-Host "Sincronizado com o Drive." -ForegroundColor Green
} else {
  Write-Host "Falha na sincronizacao (robocopy exit $LASTEXITCODE)" -ForegroundColor Red
}
