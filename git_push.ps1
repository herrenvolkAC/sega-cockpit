$mensaje = Read-Host "Ingrese el mensaje del commit"

git status
git add .
git commit -m "$mensaje"
git push