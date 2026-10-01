# npm-Veröffentlichung technisch gesperrt

## Aufgabe

Die bereits aus CI entfernte npm-Veröffentlichung zusätzlich auf Paketebene
vollständig sperren.

## Vorgehen

- Das Paket in `package.json` als privat markiert und einen explizit
  fehlschlagenden `prepublishOnly`-Schutz ergänzt.
- Den vorhandenen GitLab-Containerbau und die vollständigen Prüfungen erneut
  ausgeführt.
- Verifiziert, dass der GitHub-Spiegel keine Publishing-Workflows mehr enthält.

## Ergebnis

`npm publish` und `npm publish --dry-run` verweigern für dieses Paket nun auch
bei einem manuellen Aufruf die Veröffentlichung. Das bestehende öffentliche
Paket `0.1.3` bleibt als historisches Artefakt verfügbar; neue Versionen können
aus dem Repository nicht mehr veröffentlicht werden.

## Relevante Dateien

- [Paketmetadaten](../../../package.json)
