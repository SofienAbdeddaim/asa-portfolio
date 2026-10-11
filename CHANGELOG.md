# Changelog

## [1.2.0](https://github.com/SofienAbdeddaim/asa-portfolio/compare/v1.1.1...v1.2.0) (2026-10-11)


### Features

* **web:** new ASA circuit-chip favicon and header logo ([#15](https://github.com/SofienAbdeddaim/asa-portfolio/issues/15)) ([3f6be1b](https://github.com/SofienAbdeddaim/asa-portfolio/commit/3f6be1b273de69f441af5f185337606735058d65))

## [1.1.1](https://github.com/SofienAbdeddaim/asa-portfolio/compare/v1.1.0...v1.1.1) (2026-10-11)


### Bug fixes

* **api:** check content against the database schemas before importing ([#11](https://github.com/SofienAbdeddaim/asa-portfolio/issues/11)) ([fb758a1](https://github.com/SofienAbdeddaim/asa-portfolio/commit/fb758a1027ab95841525eccabc690b48379c769f))
* **web:** keep the experience line's tip at mid-screen however long the list ([#13](https://github.com/SofienAbdeddaim/asa-portfolio/issues/13)) ([8dd6260](https://github.com/SofienAbdeddaim/asa-portfolio/commit/8dd626020c568c3d9395dc34d40b5a6565915e51))
* **web:** make the experience line end at the sticky star while scrolling ([#14](https://github.com/SofienAbdeddaim/asa-portfolio/issues/14)) ([4c3c3d5](https://github.com/SofienAbdeddaim/asa-portfolio/commit/4c3c3d5e6f39543a222c710cf45cba108aecb50f))

## [1.1.0](https://github.com/SofienAbdeddaim/asa-portfolio/compare/v1.0.0...v1.1.0) (2026-10-11)


### Features

* **api:** add content:import to load real content from a JSON file ([#9](https://github.com/SofienAbdeddaim/asa-portfolio/issues/9)) ([9422fff](https://github.com/SofienAbdeddaim/asa-portfolio/commit/9422fffe5941e4406a9f6a9c4d1ad898b265f4c1))

## 1.0.0 (2026-10-09)


### Features

* **api:** NestJS API with password + TOTP auth, content CRUD and Docker setup ([7e7d3bb](https://github.com/SofienAbdeddaim/asa-portfolio/commit/7e7d3bb5fc98fee52b29e3e41c5094cb48a085a0))
* back-office with 2FA sign-in, generic content editor and secure image upload ([83f9af9](https://github.com/SofienAbdeddaim/asa-portfolio/commit/83f9af9ca75c678798f946a1bfb4aabea1e7c0e3))
* blog, print-ready CV, content snapshot pipeline and per-locale SEO ([333d482](https://github.com/SofienAbdeddaim/asa-portfolio/commit/333d48282ecf6bc0d19b0ae9a0eebbb906e6b6f5))
* CI/CD pipeline, deployment, end-to-end tests and documentation ([d6faf99](https://github.com/SofienAbdeddaim/asa-portfolio/commit/d6faf99c134ef50f7ec46607b557f856ea82d461))
* harden performance, accessibility and security ([eb6af3f](https://github.com/SofienAbdeddaim/asa-portfolio/commit/eb6af3f0a04d84a82d4f2ffac1c6a7f8ac9ddb1e))
* **web:** Angular 22 foundations with i18n, true RTL, design tokens and command palette ([1315d43](https://github.com/SofienAbdeddaim/asa-portfolio/commit/1315d430896fbadfa87d011935b10dc064361511))
* **web:** interactive playground with draggable stickers and a draw-a-circle game ([f05adac](https://github.com/SofienAbdeddaim/asa-portfolio/commit/f05adac3c33c1f03341412c727b0657f903ef901))
* **web:** sticker-book redesign and public portfolio pages ([fb36e39](https://github.com/SofienAbdeddaim/asa-portfolio/commit/fb36e39297fb93ce00816cb0e8a95ffd333e2a45))


### Bug fixes

* **ci:** follow Netlify's /en redirect in the deploy smoke test ([#5](https://github.com/SofienAbdeddaim/asa-portfolio/issues/5)) ([18fd9d8](https://github.com/SofienAbdeddaim/asa-portfolio/commit/18fd9d8f212755dce519c59f1368272e9179d722))
* **ci:** run the required checks on documentation-only pull requests and document the release token ([#8](https://github.com/SofienAbdeddaim/asa-portfolio/issues/8)) ([071a2e1](https://github.com/SofienAbdeddaim/asa-portfolio/commit/071a2e1c1a06ff5cbb255b1f6687d9329a273351))
* **ci:** tell the Netlify CLI which workspace package the site is ([#4](https://github.com/SofienAbdeddaim/asa-portfolio/issues/4)) ([a03e2b7](https://github.com/SofienAbdeddaim/asa-portfolio/commit/a03e2b7c54b82d4c3886e15f34bae6cce070b44b))
* make CI failures readable and stop the hero shifting when fonts load ([#3](https://github.com/SofienAbdeddaim/asa-portfolio/issues/3)) ([9a84341](https://github.com/SofienAbdeddaim/asa-portfolio/commit/9a843418cef3a0bf2958d2b928d7c0852399dd9d))
* run the pipeline on a private repository and close an AES-GCM weakness ([8e35795](https://github.com/SofienAbdeddaim/asa-portfolio/commit/8e35795d7c4a14ad351fe720b196220cffade9a7))
* **web:** stop the /fr hero layout shift (Linux font stand-in, stacked buttons on phones) ([#7](https://github.com/SofienAbdeddaim/asa-portfolio/issues/7)) ([4b3234d](https://github.com/SofienAbdeddaim/asa-portfolio/commit/4b3234d3169c3a703615ef25da612d294d0ce7cf))
