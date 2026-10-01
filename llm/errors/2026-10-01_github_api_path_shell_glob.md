# GitHub-API-Pfade nicht gequotet

## Was passiert ist

Die erste GitHub-API-Verifikation übergab Pfade mit `?` ungequotet an Zsh. Die
Shell behandelte sie als Dateimuster und führte `gh api` nicht aus.

## Auswirkung

Es gab keinen API-Aufruf und keine externe Änderung.

## Korrektur

Die vollständigen API-Pfade wurden einfach gequotet. Danach bestätigten ein
erwartetes `404` für das entfernte Workflow-Verzeichnis und die unveränderte
Liste historischer Läufe, dass kein Publishing-Workflow mehr aktiv ist.

## Vorbeugung

CLI-Argumente mit Query-Strings oder anderen Glob-Zeichen werden in Zsh immer
als vollständige, einfach gequotete Argumente übergeben.
