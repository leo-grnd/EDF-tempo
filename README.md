# TEMPO — Couleur EDF du jour

Petit site statique qui affiche la **couleur EDF Tempo** du jour et du lendemain
(Bleu · Blanc · Rouge), le **prix du kWh en temps réel** selon l'heure, et aide à
décider **quand consommer**. Aucune dépendance, aucun build, aucun serveur,
aucune donnée personnelle — déployable tel quel sur GitHub Pages.

Même identité visuelle que ses projets cousins **Octane** et **Pantone**
(brutaliste, sombre/clair, accent orange, trio Archivo Black / Instrument Serif / JetBrains Mono).

## Fonctionnalités

- **Aujourd'hui & demain** : couleur, date, créneau heures pleines / creuses en direct, prix actuel du kWh.
- **Conseil** : « faut-il consommer maintenant ? » + compte à rebours vers les prochaines heures creuses (et vers l'annonce de demain, ~11 h).
- **Grille tarifaire** : les 6 prix (3 couleurs × HP/HC), cellule courante surlignée.
- **Quotas de la saison** : jauges Rouge / Blanc / Bleu (jours déjà consommés, jours restants).
- **Calendrier** de la saison en heatmap (type contributions GitHub).
- **Simulateur** : coût d'un usage (lave-linge, recharge VE…) maintenant vs au tarif le plus bas.
- **PWA** : installable et fonctionnelle hors-ligne (cache).

## Données

- Couleurs : [`api-couleur-tempo.fr`](https://www.api-couleur-tempo.fr) — API publique, sans clé.
  - `…/api/jourTempo/today`, `…/api/jourTempo/tomorrow`, `…/api/joursTempo?periode[]=AAAA-AAAA`
  - `codeJour` : `0` = Inconnu · `1` = Bleu · `2` = Blanc · `3` = Rouge
- Si l'appel direct est bloqué (CORS), repli automatique via `corsproxy.io`.

## ⚠️ Mise à jour des tarifs

Les prix EDF Tempo sont **réglementés et révisés ~deux fois par an** (CRE, février & août).
Toute la grille est centralisée dans **`tariffs.js`** (constantes `COLORS`, `TARIFF_DATE`) :
c'est le **seul fichier à modifier** lors d'une révision. Grille actuelle : **1ᵉʳ février 2026**.

## Développement

Aucune installation. Servir le dossier en local :

```bash
python -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Déploiement (GitHub Pages)

1. Pousser le dossier sur la branche `main`.
2. Settings → Pages → Source : `main` / racine (`/`).
3. Le fichier `.nojekyll` est inclus pour servir les fichiers tels quels.

## Structure

```
index.html              page principale
comment-ca-marche.html  page pédagogique « Tempo, comment ça marche ? »
style.css               système de design (partagé) + composants
comment-ca-marche.css   styles de la page pédagogique
app.js                  logique : fetch + cache, HP/HC live, rendu
tariffs.js              constantes tarifs / quotas / saison  ← mise à jour annuelle
sw.js                   service worker (offline / PWA)
manifest.webmanifest    manifeste PWA
favicon.svg, og-image.svg
```

## Licence

MIT — projet indépendant, sans lien avec EDF.
