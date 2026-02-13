## [1.2.4](https://github.com/meodai/token-beam/compare/v1.2.3...v1.2.4) (2026-02-13)

### Bug Fixes

- update development script to include SYNC_SERVER_URL for local environment ([bbed858](https://github.com/meodai/token-beam/commit/bbed858f5c8ffc2b789f8c6d887c59db4752a70c))

## [1.2.3](https://github.com/meodai/token-beam/compare/v1.2.2...v1.2.3) (2026-02-13)

### Bug Fixes

- update WebSocket URL configuration in .env.example ([28cc90a](https://github.com/meodai/token-beam/commit/28cc90a76db375e56e073a14c76666174d9040b9))

## [1.2.2](https://github.com/meodai/token-beam/compare/v1.2.1...v1.2.2) (2026-02-13)

### Bug Fixes

- remove description field from plugin manifest ([a3ca8dd](https://github.com/meodai/token-beam/commit/a3ca8ddd8fd1f02f200512ba4be31bc4a59f6c90))

## [1.2.1](https://github.com/meodai/token-beam/compare/v1.2.0...v1.2.1) (2026-02-13)

### Bug Fixes

- update WebSocket URL for production sync server ([ad72523](https://github.com/meodai/token-beam/commit/ad725237d786eae454ab1b6dabdb92d4a6aa8e1c))

# [1.2.0](https://github.com/meodai/token-beam/compare/v1.1.1...v1.2.0) (2026-02-13)

### Features

- enhance fetchAndRender to support static builds and local development ([e103ded](https://github.com/meodai/token-beam/commit/e103dedf971d9b74f215ed246822b6f6d56088e3))

## [1.1.1](https://github.com/meodai/token-beam/compare/v1.1.0...v1.1.1) (2026-02-13)

### Bug Fixes

- **changelog:** remove unnecessary blank line in version 1.1.0 section ([21392f6](https://github.com/meodai/token-beam/commit/21392f6f3c1a7183ef42bfbfee43e7c93e85d5e9))
- **pages:** remove environment configuration from deploy job ([f8658a3](https://github.com/meodai/token-beam/commit/f8658a3bb394b4728b12a7f055de3110001c94d7))
- **release:** update prepare command to format changelog and package.json ([0aff28c](https://github.com/meodai/token-beam/commit/0aff28cc5963dddc2b7ef065783d113564b0e219))

# [1.1.0](https://github.com/meodai/token-beam/compare/v1.0.3...v1.1.0) (2026-02-13)

### Features

- **pages:** add GitHub Actions workflow for deploying demo to GitHub Pages ([55ed612](https://github.com/meodai/token-beam/commit/55ed6122a94508c684b62818aeff8f1c3d866759))

## [1.0.3](https://github.com/meodai/token-beam/compare/v1.0.2...v1.0.3) (2026-02-13)

### Bug Fixes

- **release:** update workflow to use npm 11 ([4aac3ac](https://github.com/meodai/token-beam/commit/4aac3acf2c17ab8be084df3479140a1dba323a28))

## [1.0.2](https://github.com/meodai/token-beam/compare/v1.0.1...v1.0.2) (2026-02-13)

### Bug Fixes

- **manifest:** add description to the plugin manifest ([ba9bbfe](https://github.com/meodai/token-beam/commit/ba9bbfef67e276a2012c9faae3e22371bd303401))

## [1.0.1](https://github.com/meodai/token-beam/compare/v1.0.0...v1.0.1) (2026-02-13)

### Bug Fixes

- update repository URL format in package.json ([abfe1d5](https://github.com/meodai/token-beam/commit/abfe1d5de89ca1f09462f240c07184dafd23973f))

# 1.0.0 (2026-02-13)

### Bug Fixes

- add text-wrap property to paragraph in index.astro for better text handling ([41cb641](https://github.com/meodai/token-beam/commit/41cb641f7d7e309812b5cee495a3b1235a7d81a6))
- adjust position of message container and error notifications for better alignment ([a85c8ea](https://github.com/meodai/token-beam/commit/a85c8eaebb92c55eb41cb9ea0d19da8c49b043e1))
- adjust position of status indicator in demo widget ([4bf30dd](https://github.com/meodai/token-beam/commit/4bf30dd93a2c8c9ee00007c529eea84a65a32d79))
- center paragraph in index.astro by adding margin-inline auto ([79a65a0](https://github.com/meodai/token-beam/commit/79a65a0e6a02e1232b82f78b17aa6c096d241a08))
- clarify comment on design tool update timing in index.astro ([a4b743a](https://github.com/meodai/token-beam/commit/a4b743a8b07401043adb93f6d7bd092e920bce07))
- clarify token format comment in generateToken method ([3dd6fcc](https://github.com/meodai/token-beam/commit/3dd6fccbec2f6b2e299a4dbff6aa1391394cd559))
- prevent double-handshake in WebSocket connection handling ([fec16ac](https://github.com/meodai/token-beam/commit/fec16acdb440ae3756f6797f6a705afad7880e5a))
- resolve ESM module resolution in sync-server ([6bfddf6](https://github.com/meodai/token-beam/commit/6bfddf6ff4e6a5d7081c24f82d69c52f2c0418df))
- show session token in demo and sync only when Figma connects ([b2e06db](https://github.com/meodai/token-beam/commit/b2e06db52b0c8859f9c055f4390f7f6b269ec32e))
- **sync:** add error logging for connection issues in sync client ([bd7135f](https://github.com/meodai/token-beam/commit/bd7135f4cf2444d632f4b982ba3ba54617660383))
- target ES2015 for Figma sandbox code build ([054a61c](https://github.com/meodai/token-beam/commit/054a61c4749e84b385c922f47003378494760c32))
- update branding from "↬" to "⊷" for Token Beam across all documentation and code ([d3b8a11](https://github.com/meodai/token-beam/commit/d3b8a11b1c2e5d349b26726eaba5a38ae945525f))
- update changelog link to point to token-beam repository ([04cd350](https://github.com/meodai/token-beam/commit/04cd3508dac7d8604a7ee5886f086b71765e957d))
- update copyright name from Daniel Stutz to David Aerne in LICENSE files and documentation ([9c99fd4](https://github.com/meodai/token-beam/commit/9c99fd41fdfbccd73c15bd8fe932a5f246e11020))
- update example tokens in README for consistency and clarity ([560e0fe](https://github.com/meodai/token-beam/commit/560e0fe322e327a63815212a062f75406de56517))
- update token format to use 'dts://' prefix in documentation and code ([e3375f4](https://github.com/meodai/token-beam/commit/e3375f46ed018d692bddcd369fcefdd708c5ea29))
- update token-beam dependency version to allow any version ([047e3dc](https://github.com/meodai/token-beam/commit/047e3dc1bb7d7c6b402e3561ff124d9726b10115))

### Features

- add Adobe XD plugin with installation scripts, README, and TypeScript configuration ([1540395](https://github.com/meodai/token-beam/commit/15403955ad816f0f5f995e41160ae3b6ab8d837c))
- add Aseprite plugin documentation and installation instructions; update package.json and .gitignore ([a3897bd](https://github.com/meodai/token-beam/commit/a3897bdfc9f783e0a32db774670f3013dc947119))
- add Blender add-on for syncing design token colors with real-time updates ([364f702](https://github.com/meodai/token-beam/commit/364f7023b055d3d5d2149e4823170097ff4b91a5))
- add color application functionality and linear color conversion in Token Beam ([d1c8127](https://github.com/meodai/token-beam/commit/d1c8127f8056352280cbb7cf233480e2a7d8d575))
- add Dockerfile and .dockerignore for sync server deployment ([b365cf1](https://github.com/meodai/token-beam/commit/b365cf16a6f84477ce6df03f7753e50f185353a3))
- add environment variable support for WebSocket Sync Server URL ([7e04bdd](https://github.com/meodai/token-beam/commit/7e04bdd9b00358be7ec858ccca1d43bd708bc04b))
- add health check endpoint for Token Sync Server ([3037f0c](https://github.com/meodai/token-beam/commit/3037f0c90ed74b24be4e33bd2327ce617074ffa1))
- add help widget with tooltip and plugin links to token sync demo ([027f4be](https://github.com/meodai/token-beam/commit/027f4be45e7d3c852d15996686d62c25d15e42cc))
- add installation scripts and package entries for Aseprite, Sketch, Krita, and Adobe XD plugins ([4cd8701](https://github.com/meodai/token-beam/commit/4cd8701bb2fbd75278dea8f6b7beab48f6c3b43b))
- add integration specification document for Token Beam sync server ([448c802](https://github.com/meodai/token-beam/commit/448c8027558270d8a804ee0bc7ef8b74c1bcf490))
- add lib-dist/ to .gitignore ([35ac65c](https://github.com/meodai/token-beam/commit/35ac65ce1a21b6867d55b25572c098858ee77337))
- add LICENSE files and update package.json with licensing information for core library and sync server ([9f06223](https://github.com/meodai/token-beam/commit/9f06223c9b112f8454035c5d3179860b91054389))
- add license information to README files for Adobe XD, lib, and Sketch plugins ([c36054c](https://github.com/meodai/token-beam/commit/c36054c214f585ec01a5ca99e1055ff014a917d1))
- add linear to sRGB conversion and sync colors to Blender palette in Token Beam ([702e079](https://github.com/meodai/token-beam/commit/702e079c9f8dc5cd194ccdbd58737474437768b8))
- add material handling for token colors in Token Beam ([ef7cb92](https://github.com/meodai/token-beam/commit/ef7cb925abdf0711742c908fa044530d54b9b6bf))
- add origin field to sync protocol ([4484ab2](https://github.com/meodai/token-beam/commit/4484ab270f2ad731196eef026a7337fef74c69ff))
- add README for Token Beam MCP server with usage instructions and features ([9379e85](https://github.com/meodai/token-beam/commit/9379e85f968f8aec89308ed8e2d7668ebd7cef41))
- add README.md with token sync widget example and implementation details ([201c898](https://github.com/meodai/token-beam/commit/201c8989d90db864ac82b446d2f8f5d222ba44ad))
- add settings configuration for token-beam MCP server ([a33d119](https://github.com/meodai/token-beam/commit/a33d119624b395f25d54db7bafc36d17683bf062))
- add Sketch plugin with WebSocket integration for syncing design tokens ([3ff847e](https://github.com/meodai/token-beam/commit/3ff847e5a929751bf8a6423812f53b63118ebe6a))
- add status display to widget for copy confirmation and improve user feedback ([705ce02](https://github.com/meodai/token-beam/commit/705ce023afe9946a7a7f43100f6d5dba7b255818))
- add sync-server package for real-time token synchronization ([32cd529](https://github.com/meodai/token-beam/commit/32cd529067521636db81e8d02523d21bea07af94))
- add tsconfig.docker.json for TypeScript configuration in Docker ([3a58a10](https://github.com/meodai/token-beam/commit/3a58a1038363f2e482abf57ac323e2b2ea022675))
- add WebSocket live sync support to Figma plugin ([5e05a1f](https://github.com/meodai/token-beam/commit/5e05a1f826a8950b7cd893a4a91c28dce52b140f))
- add zod validation schemas and integrate payload validation in sync server ([6564bc0](https://github.com/meodai/token-beam/commit/6564bc03b8293174c1de9e6b498e48f9ac0d4631))
- allow custom sync server URL during installation and adjust dialog width ([48bd220](https://github.com/meodai/token-beam/commit/48bd220b76a847d06b7104fd6ab1386054f226a7))
- auto-assign palette to paint settings and enhance synced color display in Token Beam panel ([f48d780](https://github.com/meodai/token-beam/commit/f48d780e5afe67ed41942f1280bce9906d2b9eea))
- change npm ci to npm install in Dockerfile for dependency installation ([7e3d198](https://github.com/meodai/token-beam/commit/7e3d19855f137ce376dabd1e778f675d89aec4de))
- collection name input and persistent collection on re-sync ([7c5f360](https://github.com/meodai/token-beam/commit/7c5f36065ee201fa51267a2c516c93fc0aac6da4))
- **demo:** add interactive demo section with color synchronization feature ([324fa1d](https://github.com/meodai/token-beam/commit/324fa1d6a0c74c2ff473b67a2a667d33a757e26d))
- **docs:** update README for widget implementation details and quick start instructions ([9568e59](https://github.com/meodai/token-beam/commit/9568e594bb0638e77721919d9f0620f1ca7b58c0))
- enhance collection name input handling and connect button logic for improved user experience ([83c3226](https://github.com/meodai/token-beam/commit/83c32261c8bfed33b63a321b6adce66f3dbe580d))
- enhance color handling and improve error reporting in Token Beam ([9542a2b](https://github.com/meodai/token-beam/commit/9542a2be5893be374e3a3292d72b6d1749ac3d3e))
- enhance color palette integration and improve color clearing functionality in Token Beam ([3de9c71](https://github.com/meodai/token-beam/commit/3de9c71dc81f799fd6f34085572b8409776e8c75))
- enhance color synchronization by adding hex normalization and updating swatches via Sketch API ([bee3b37](https://github.com/meodai/token-beam/commit/bee3b3751f670cf0c34a5f6b1ac8da1ab2b68579))
- enhance connection handling in Token Beam with improved WebSocket message processing and error reporting ([390f896](https://github.com/meodai/token-beam/commit/390f896fb3180e482bbc7ec41ac76dd34ffe541a))
- enhance error message handling and display logic for improved user feedback ([1d97247](https://github.com/meodai/token-beam/commit/1d9724779f85015324692454f2d63c18591bf93d))
- enhance help widget functionality with toggle and accessibility improvements ([15dc8a4](https://github.com/meodai/token-beam/commit/15dc8a4a528e71a71370ff0e127f18f68218dad8))
- enhance help widget with toggle functionality and accessibility improvements ([cc90256](https://github.com/meodai/token-beam/commit/cc902567078e22eac182cec456d3784c40824c56))
- enhance index page with new styles and features ([e5e6138](https://github.com/meodai/token-beam/commit/e5e6138ab5f69fa8252d754ad3aa189713881fdc))
- enhance session management and user feedback in Token Beam sync tools ([7d5debc](https://github.com/meodai/token-beam/commit/7d5debc7b91420bb87f1d26f5c34011ec38c7a3f))
- enhance sync status and result display with relative time formatting ([0420e03](https://github.com/meodai/token-beam/commit/0420e03e297d59e71ddba5b9b99884487d030332))
- enhance sync status and result UI with improved styling and class management ([73016cd](https://github.com/meodai/token-beam/commit/73016cd85643dfb6fd573e328f027a84c6488aed))
- enhance SyncClient with connection timeout and exponential backoff for reconnection ([41c67a6](https://github.com/meodai/token-beam/commit/41c67a63b2f5de7e43d222c468d84598c49b50aa))
- enhance Token Beam functionality with improved context handling and notification messages ([30096dc](https://github.com/meodai/token-beam/commit/30096dce6b3a8b15b306b328132e9bc2042bc64d))
- enhance Token Beam functionality with improved notification handling and color synchronization logic ([1aac1ef](https://github.com/meodai/token-beam/commit/1aac1ef70f12f52df6f224164cfc8c9eee0f7fb5))
- enhance Token Beam functionality with improved window dimensions and error handling ([35c7c0b](https://github.com/meodai/token-beam/commit/35c7c0ba4e8ed91111da2e4316fc80eeb27c165e))
- enhance Token Beam UI loading logic with improved path resolution and error handling ([b78c8ab](https://github.com/meodai/token-beam/commit/b78c8ab05c4bafa8e3936359587f8841b2cf3da4))
- enhance Token Beam with improved window creation error handling and plugin lifecycle management ([fabc503](https://github.com/meodai/token-beam/commit/fabc5036df6e95957be0854778786199e16af943))
- enhance token sync widget with status display and improved unlink button functionality ([25a43d4](https://github.com/meodai/token-beam/commit/25a43d456d6f66dbdbea8f067d5a554cbeb30eda))
- enhance TokenSyncServer with payload size limit and improved token generation ([2735606](https://github.com/meodai/token-beam/commit/273560663e8e5bbf42539722bf629eb0a32c145f))
- enhance WebSocket message handling and improve connection management ([7de776c](https://github.com/meodai/token-beam/commit/7de776cb2ef19de86070fa39882082a0eda20943))
- enhance widget styles with box shadows for better visual feedback on connection status ([e07dfd1](https://github.com/meodai/token-beam/commit/e07dfd1e51c66ce4875976fc315118b189387dd0))
- handle Figma client disconnection error to update sync status appropriately ([6e4658b](https://github.com/meodai/token-beam/commit/6e4658b0249eec08273d0858dc416ade0cfb67f1))
- implement CORS support and add endpoint for fetching plugin list in sync server ([2dd7d5f](https://github.com/meodai/token-beam/commit/2dd7d5f3639c43a4425e882c98b4e10b984e299b))
- implement GitHub Actions workflow for building and bundling plugins; update package scripts and references to token-beam ([cf4a604](https://github.com/meodai/token-beam/commit/cf4a6046af69772e709d5f93c9e89da5bc4d1876))
- implement offline state handling with visual feedback in the widget ([1c2cd34](https://github.com/meodai/token-beam/commit/1c2cd3478428cdbc4b6d010ef0eef243ec992583))
- implement session management improvements for web client disconnections ([2257b5a](https://github.com/meodai/token-beam/commit/2257b5a3f6e3fdb76eace4b1e22d7e4ce99b8a3e))
- implement Token Beam MCP server with design token sync capabilities ([2d8d297](https://github.com/meodai/token-beam/commit/2d8d29707783fc4cd93eb59cadd2e68e8952fe56))
- implement TypeScript support and WebSocket integration for Sketch plugin ([0e6c654](https://github.com/meodai/token-beam/commit/0e6c654d3f74ba277eb50253356f8e5ef871968f))
- improve collection name validation and update connect button logic for enhanced user experience ([81b186e](https://github.com/meodai/token-beam/commit/81b186e0d03a3f17f6273f35553f6794fb310f1a))
- improve connection handling by managing manual disconnect state to prevent unwanted reconnections ([2a05314](https://github.com/meodai/token-beam/commit/2a053146a28f214b2defde26f1f74885c426919b))
- improve UI resource path resolution and error handling in Token Beam ([42b4e2f](https://github.com/meodai/token-beam/commit/42b4e2f15f4390a0322f54b7bfc582730af00d94))
- initialize Figma Sync monorepo with demo and plugin packages ([678d8a4](https://github.com/meodai/token-beam/commit/678d8a437f24364dc47335eccda77ee43fbeddce))
- integrate sketch-module-web-view for improved color synchronization and UI handling ([7fd2d45](https://github.com/meodai/token-beam/commit/7fd2d4531f771c29dff10874e05a14454fc732c7))
- **licensing:** implement commercial use monitoring and origin blocking in sync server ([dd9dd42](https://github.com/meodai/token-beam/commit/dd9dd428166a50ce604ddb28f9ff93c21e992b92))
- **marketing:** add marketing package with initial setup ([cc36601](https://github.com/meodai/token-beam/commit/cc36601ef9f239d3171632a5f7a1881523be355c))
- **mcp-server:** add new MCP server for design token synchronization ([fd680eb](https://github.com/meodai/token-beam/commit/fd680eb16a27a22639c8345575ccf39192cf04a2))
- **mcp-server:** integrate token-beam for token collection and payload handling ([016f5ce](https://github.com/meodai/token-beam/commit/016f5ce4c91d1b58258842995ba3fd05d5fb32a3))
- **pricing:** update pricing structure and details for sync server and marketing page ([94f6637](https://github.com/meodai/token-beam/commit/94f6637c0eb23841fb20eb35aad91d7fde3aa46c))
- refactor HTML and CSS class names for improved consistency and readability ([bebf83a](https://github.com/meodai/token-beam/commit/bebf83a4459bff71476ab8df163da87bbcb8ef3c))
- refactor sync section to use dts-widget structure and improve styling ([92dd90e](https://github.com/meodai/token-beam/commit/92dd90edd0c1ea8efc70b857379f020611f863c6))
- refine UI layout and improve sync status handling for better user feedback ([64527c4](https://github.com/meodai/token-beam/commit/64527c49d430a9168bc86246d7591f2f749a55e2))
- refine widget styling for improved layout and user interaction ([15c9a8b](https://github.com/meodai/token-beam/commit/15c9a8b5fa28e8d460eb450d44c0949f3b4bdc98))
- remove redundant title label from dialog in token sync plugin ([77afa44](https://github.com/meodai/token-beam/commit/77afa44586a8dadf09ed8330ab10eb151efe1963))
- reset UI state on connection errors and disconnections for improved user experience ([7e49c0b](https://github.com/meodai/token-beam/commit/7e49c0bd6a70d8d8a5dc9841322e35480d2170fa))
- **security:** enhance WebSocket client verification with IncomingMessage type ([ddf4675](https://github.com/meodai/token-beam/commit/ddf467572dda7526eb710d9820adbe9468e856ab))
- **security:** implement origin blocking for WebSocket connections ([73e30f5](https://github.com/meodai/token-beam/commit/73e30f55b3879e8e87f6cea84c54a5ecdf85ba46))
- simplify color ramp generation and update collection handling in sync process ([3db4747](https://github.com/meodai/token-beam/commit/3db47477a83715169bb3972b68d20a6f4ab54e63))
- simplify HTML file path resolution in Token Beam UI loading logic ([3dc1a02](https://github.com/meodai/token-beam/commit/3dc1a02e90bce117a38b74b70f23ac1965c7d8c2))
- update build script to target ES2015 and add esbuild command to permissions ([77ab49d](https://github.com/meodai/token-beam/commit/77ab49d0b5fa87142983e2720584973a22a164ae))
- update contact email for licensing inquiries across documentation and code ([d0224a0](https://github.com/meodai/token-beam/commit/d0224a093dc3c15579aa0328373ec0bbf2342db7))
- update Dockerfile and .dockerignore for improved build process ([a3f47cd](https://github.com/meodai/token-beam/commit/a3f47cd621fd8cb20fe2723ddb59b4280bf30f0d))
- update Dockerfile and package.json for local token-beam dependency and deployment scripts ([cf7ea9c](https://github.com/meodai/token-beam/commit/cf7ea9c040648e0b2b34808ee0bbf736ea8c8a51))
- update hero section text and add architecture diagram for token sync ([e09c8ba](https://github.com/meodai/token-beam/commit/e09c8ba302b823a1f0ee5314aefcebcf10e8c5e9))
- update license to dual AGPL-3.0 and Commercial License with detailed terms and pricing ([3dbab51](https://github.com/meodai/token-beam/commit/3dbab515be94bcef0f9920822482131044948f9d))
- update licenses to AGPL-3.0 OR Commercial across all plugins and server documentation ([4ac8c29](https://github.com/meodai/token-beam/commit/4ac8c295779299fb735180afb5c1ef334d552043))
- update licenses to AGPL-3.0-or-later across all packages and documentation ([7174bf9](https://github.com/meodai/token-beam/commit/7174bf94ebad61ca976f22e0cd3eb10702072916))
- update message display styles and improve accessibility for error notifications ([af45b44](https://github.com/meodai/token-beam/commit/af45b44bc464276d13c19a487efcca2a9e7aa07e))
- update plugin URLs to point to GitHub repositories for Figma, Sketch, Aseprite, Krita, and Adobe XD ([692286b](https://github.com/meodai/token-beam/commit/692286baed529af828f634d6769d5e1543a6b998))
- update plugin URLs to point to token-beam repository ([ac7fa5a](https://github.com/meodai/token-beam/commit/ac7fa5ad5037b5bc868e8c69930044e1293d21b8))
- update README and documentation to include "↬" branding for Token Sync ([aca6e0e](https://github.com/meodai/token-beam/commit/aca6e0e8ccc857f2d73d80f8a9addbec7cc8fc04))
- update README and manifest to reflect color variables terminology; enhance color syncing logic with variable and fallback handling ([910080d](https://github.com/meodai/token-beam/commit/910080d0fb4c7838d14b47c646416c4a9af98735))
- update sync status handling on disconnection and error events for improved client state management ([e2001a0](https://github.com/meodai/token-beam/commit/e2001a026a16522545849c9f26c90870405e77fc))
- update SyncSession and SyncMessage interfaces to support multiple target clients; enhance client handling in TokenSyncServer ([aa70fe4](https://github.com/meodai/token-beam/commit/aa70fe4670d1dcdf8d5f0df88824290084d1240c))
- update Token Beam panel to enhance color application and improve palette display ([82384d0](https://github.com/meodai/token-beam/commit/82384d01193f1ed7d1bcccd7fb220d4c5979d2f4))
- update token format to prefixed strings and improve color handling ([737990e](https://github.com/meodai/token-beam/commit/737990e1f75aacc6869cbd1a84b13199d20e74dd))
- update UI elements for improved sync status display and user feedback ([248e40b](https://github.com/meodai/token-beam/commit/248e40bcd3c703be3b941ad018529d1c0e1927c1))
- update unlink button styles for improved visibility and user interaction ([452bb8c](https://github.com/meodai/token-beam/commit/452bb8cc2b993bb08c642577bab8f98c74c29b2c))
- update widget label styling and structure for improved readability ([e971d22](https://github.com/meodai/token-beam/commit/e971d223a51dca6d2045fdfea2a80eb6a92e03e8))
- update widget structure with data attributes for improved accessibility and maintainability ([9abbe3f](https://github.com/meodai/token-beam/commit/9abbe3f3bb0b1074400045799b0f8489543a134d))
- update widget styles for improved layout and accessibility ([0fd37e9](https://github.com/meodai/token-beam/commit/0fd37e96131ff81e99e5f8e47dde0f7bd2426f44))
- **widget:** add example widget with interactive demo and integration code ([1d486f3](https://github.com/meodai/token-beam/commit/1d486f3d4e5093baf98f4ed364ea334c152351c7))
