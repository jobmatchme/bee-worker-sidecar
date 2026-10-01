# npm-Dry-Run prüfte private Markierung nicht

## Was passiert ist

`npm publish --dry-run` erstellte trotz `"private": true` erfolgreich ein
simuliertes Veröffentlichungsartefakt. Der Dry-Run belegt damit nicht, dass ein
echter Registry-Upload blockiert würde.

## Auswirkung

Es wurde nichts veröffentlicht; `--dry-run` führte keinen Upload aus. Die
gewünschte technische Sperre war aber nicht mit einem ausführbaren Negativtest
belegt.

## Korrektur

Zusätzlich zur privaten Paketmarkierung wurde ein absichtlich fehlschlagender
`prepublishOnly`-Schutz ergänzt. Derselbe Dry-Run muss nun vor dem Packen und
vor jedem Upload mit einer eindeutigen Meldung abbrechen.

## Vorbeugung

Eine Publikationssperre wird mit einem negativen Test des tatsächlichen
Lifecycle-Hooks geprüft. Paketmetadaten allein und ein erfolgreicher Dry-Run
sind kein ausreichender Beleg.
