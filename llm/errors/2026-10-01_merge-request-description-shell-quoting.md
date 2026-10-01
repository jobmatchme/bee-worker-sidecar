# Merge-Request-Beschreibung falsch gequotet

## Was passiert ist

Der erste Aufruf zum Erstellen des Merge Requests enthielt Markdown-Backticks
in einem doppelt gequoteten Shell-Argument. Zsh interpretierte den Inhalt als
Command-Substitution und brach den Aufruf bereits beim Parsen ab.

## Auswirkung

Es wurde bei diesem Versuch kein Merge Request erstellt und kein externer
Zustand verändert.

## Korrektur

Der Aufruf wurde mit einer vollständig einfach gequoteten Beschreibung ohne
auswertbare Shell-Syntax wiederholt. Der Merge Request wurde damit erfolgreich
erstellt.

## Vorbeugung

Mehrzeilige Beschreibungen für CLI-Aufrufe dürfen keine shell-auswertbare
Syntax in doppelt gequoteten Argumenten enthalten. Wo möglich, sind einfache
Quotes oder eine dateibasierte Beschreibung zu verwenden.
