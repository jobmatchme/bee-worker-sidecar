# GitLab als einzigen Sidecar-Artefakt-Publisher vorbereitet

## Aufgabe

Den kanonischen `bee-worker-sidecar`-Stand einschließlich Version `0.1.3` nach
GitLab übernehmen, das Container-Image direkt aus dem geprüften Commit bauen
und weitere npm-Veröffentlichungen beenden.

## Vorgehen

- Die vier GitHub-Commits nach GitLab `main` als Fast-Forward-Basis übernommen.
- Einen direkten Multi-Stage-Docker-Build aus Quellcode und Lockfile erstellt.
- Eine GitLab-CI-Pipeline nach dem bewährten `bee-slack`-Publishervertrag
  ergänzt.
- GitHub-Actions-Workflows für GHCR und npm aus dem kanonischen Stand entfernt.
- Repository-Metadaten und README auf GitLab, unveränderliche SHA-Tags und das
  Ende der npm-Veröffentlichung umgestellt.

## Ergebnis

- Merge-Requests validieren Quellcode und Tests.
- GitLab `main` und semantische Release-Tags veröffentlichen ausschließlich
  `registry.gitlab.com/jobmatchme/cf/bee-worker-sidecar:sha-<commit>`.
- Ein vorhandener SHA-Tag wird nur wiederverwendet, wenn sein vollständiges
  OCI-Revision-Label dem Commit entspricht.
- Das Image hängt nicht mehr von einem zuvor veröffentlichten npm-Paket ab.
- Das vorhandene npm-Paket `0.1.3` bleibt bestehen; neue Versionen werden nicht
  veröffentlicht.
- Die entfernten GitHub-Workflows werden auf GitHub erst nach erfolgreichem
  GitLab-/Bici-Cutover wirksam gespiegelt.

## Relevante Dateien

- [GitLab CI](../../../.gitlab-ci.yml)
- [Dockerfile](../../../Dockerfile)
- [README](../../../README.md)
- [Paketmetadaten](../../../package.json)
