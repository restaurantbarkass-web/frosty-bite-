# Changelog

## [1.7] - 2026-09-05 (PRODUCTION)
- **Build / Version Code**: `8`
- **Release Details**:
* 5ada7c9 feat: redesign home and categories experience, update navigation and food components


## [1.6] - 2026-09-03 (PRODUCTION)
- **Build / Version Code**: `7`
- **Release Details**:
* ac86325 feat: update server AI config, guide documentation, and gitignore keystore rules
* 43594ae chore(release): bump version to 1.5 (build 6) [production]
* e03c43e feat: sync latest updates, feedback management, order collected workflow, and admin enhancements
* 757f405 feat(admin): add bakery location management
* cf49578 feat: add pickup status workflow
* 1ae6ec0 refactor(upi): remove transaction reference from URI
* 61ae787 refactor: remove UPI dev diagnostics from checkout
* 8279dfd feat: standardize UPI transaction reference (tr)
* dcfa0c4 feat(upi): add diagnostic suite for UPI intent testing
* 10215ca fix(payment): improve reliability and data integrity
* 77f2670 fixed
* 071f19a fixed
* 2f3e0ad fixed
* 007f4f3 fixed phonepe issue
* c2d629c fixed 5
* 9916b83 fixed 4
* d9daf96 fixed3
* d8c904b refactor(checkout): unify auth token retrieval
* df4e6ae fixed
* 8f2508a fix : session management
* b55d6f0 payment session fixed
* c8954c7 fixed 2.0
* 6b40a9a fix: stabilize UPI timer and refresh logic
* 130c4f2 fixed
* 4f950ff fix: update UPI payment timer initialization
* abec4de fix: sync UPI timer with authoritative expiration
* 2d70078 fix(payment): add robust order ID sanitization
* 855eaa4 fix: improve order lookup and payment handling
* f910569 refactor: centralize brand logo management
* 068f1ad refactor: unify logo assets and improve payment auth
* cdcc7c0 feat: update branding to SVG logo
* e2b4631 refactor: update logo to use local asset path
* 57888dd fix(auth/orders): strengthen auth and sanitize database updates
* ff77d3f fix(payment): return 200 status for successful payments
* 540593a refactor: strengthen authentication and access control
* 9fd8a43 feat(payment): add back navigation and UI polish
* 8f8f5fb feat(payment): auto-convert COD/Cash to UPI for online payments
* 96827c4 fix: improve UPI payment status polling reliability
* 1777e7b fixed
* 8709c03 supabase configuration fixed
* c570c92 network error fixed
* bb6a68a fix: improve CommonJS module compatibility and build
* aeac19a build: bundle app separately for serverless deployment
* 81893c9 feat: integrate core application routes
* 84060d9 feat(payment): implement robust checkout recovery
* 609d82e feat: improve UPI payment robustness
* ce4fc0a feat(payment): enhance UPI checkout flow and security
* 7ec48d9 build: switch API runtime to bundled app artifact
* 2c01748 root cause fixed
* 7ca0ff0 build: improve Vercel deployment compatibility
* f64e76d chore: update vercel rewrites for api routing
* 1f78213 feat: update routes and improve rate limiting
* fa5d896 feat: implement payment verification system
* 645650e feat(payment): implement FrostyPay device event API
* fe1d2b5 refactor(auth): export UserRole and improve cache error logging
* 8469354 refactor(server): simplify Supabase client initialization
* 77dad8e refactor: improve environment variable security
* e21f355 feat(notifications): implement push notification system
* 82b3b1c feat: implement push notifications and reorder flow
* dbd8236 refactor: standardize order ID formatting
* 45027db feat: add scheduled delivery and cake customization
* d969e38 refactor: improve component key stability
* d92ab5d refactor(animations): improve animation system and assets
* 9c40504 refactor: improve Lottie data handling and retry logic
* 0cdf646 animation fixed
* 4b3bf45 Add WhatsApp order confirmation system
* 3a70b88 feat(admin): implement order cancellation reasons and delivery updates
* 39155a9 refactor: extract order cancellation logic to page component
* d753827 feat(admin): implement WhatsApp cancellation workflow
* 76c94f8 feat(auth): increase OTP length to 8 digits
* 5c58f9e feat: support dynamic OTP length and auth fallback
* 1ea2f3a refactor: remove OTP session resumption logic
* e421c53 refactor(auth): enforce 6-digit OTP delivery
* 72958e1 feat: implement lazy component loading with retries
* 596da4e feat(email): enforce 6-digit OTP format
* ada807c feat(auth): integrate OtpInput component
* dc23c45 fix: improve OTP dispatch reliability and error handling
* 30e06a5 feat(auth): transition to 6-digit custom email OTP
* e8af449 refactor: add FAQ navigation and optimize scroll logic
* 3c197d1 refactor: hide navbar on product pages
* 22b318a refactor: optimize authentication and component loading
* 8b75dae feat: add app versioning and update notification system
* 4bdb920 feat(notifications): standardize cross-platform notifications
* 30b1fa4 perf: optimize component rendering and loading
* abfc264 fix: calculate delivery fee correctly for pickups
* 5df674e feat: add guest wishlist support and UI skeletons
* e5450e7 feat(auth): disable mobile login and show coming soon toast
* ed38f98 feat: allow guest checkout by removing login wall
* 444a333 fix: improve app_settings update reliability
* f57f025 perf: implement lazy loading and checkout persistence
* 3296af7 fix: implement fallback for ordering status update
* c833eac fix(admin): improve menu item data parsing logic
* 24f484f feat(auth): implement unified getAuthToken method
* f640cfc chore: optimize build chunking strategy
* 9fb3ae5 chore: update .gitignore to include dist/
* ffc1da5 feat: add haptic feedback to logout action
* 0499d8e feat(guest): add convertToUser helper and export
* fe8e52a feat: implement guest profile persistence at checkout
* b228106 feat: implement guest user session and auth modal
* e131610 refactor: remove bloated compiled api/index.js
* 8357f3c feat: temporarily disable geofencing service
* a33fc3c feat(config): disable geofencing by default
* 7911658 feat(admin): implement slide-to-confirm for actions
* 55c5053 build: enable sourcemaps for server bundle
* ed90656 refactor: improve hook stability and state updates
* 1c5606d feat: add FAQ page and unify geofencing API routes
* 99135c0 build: refactor serverless API and environment loading
* 868473d refactor: migrate geofencing storage from Firestore to Supabase
* 0dc57c6 fix: update firebase-admin initialization
* 3a34147 fixxed all typescript error
* f9c8797 fixed type script
* 71681fb fixed typescript
* 4a29aba typescript error fixed
* f426d97 fixed typescript err0ors
* c4957e3 typescript error fix
* 8d7e47a vercel fixed
* 9cee1a0 updated files
* 0510031 chore(release): bump version to 1.5 (build 6) [production]
* 6287fcd updaated
* 44f2b56 chore(release): bump version to 1.5 (build 6) [production]
* 6a2439f update
* 15c765e chore(release): bump version to 1.5 (build 6) [production]
* acd8abc updated
* e0ff14c chore(release): bump version to 1.5 (build 6) [production]
* c6641e3 fixed
* 3ab5e74 chore(release): bump version to 1.5 (build 6) [production]
* df4ceb7 fised
* 28f7483 chore(release): bump version to 1.5 (build 6) [production]
* 7a7c140 official update
* 4dd45f1 chore(release): bump version to 1.5 (build 6) [production]
* 3d464c1 error fixed !!
* 16ce6a3 chore(release): bump version to 1.5 (build 6) [production]
* 97cbc50 fix the issue
* 4148e0a chore(release): bump version to 1.5 (build 6) [production]
* 7052aaa fix(geofencing): improve service area resilience
* 96f1cb6 chore(release): bump version to 1.5 (build 6) [production]
* 417024b feat(geofencing): enable upsert for existing cities
* 7f5e40e chore(release): bump version to 1.5 (build 6) [production]
* d4c6d63 fix: improve geofencing error reporting and version
* f2e3231 chore(release): bump version to 1.5 (build 6) [production]
* 5d94c24 fix: improve geofencing resilience and rollback
* 00b1982 chore(release): bump version to 1.5 (build 6) [production]
* be4072f chore(release): roll back version to 1.4
* 9286b95 chore(release): bump version to 1.5 (build 6) [production]
* 1a014b1 fix: improve geofencing resilience and rollback version
* efab765 chore(release): bump version to 1.5 (build 6) [production]
* 3b6bd21 chore: revert build changes and downgrade version
* 97b6129 chore(release): bump version to 1.5 (build 6) [production]
* 04f98a1 chore: improve build pipeline and service stability
* d458b23 chore(release): bump version to 1.5 (build 6) [production]
* 7755317 feat: upgrade AI models and enhance error handling
* 2ff9e90 chore(release): bump version to 1.5 (build 6) [production]
* 67614bf feat(geofencing): update Odisha service boundaries
* 25201a7 chore(release): bump version to 1.5 (build 6) [production]
* 1ae139f feat: implement geofencing v2 infrastructure
* 340e166 feat(orders): implement fallback for order insertion
* b59df1e chore: update AI model, API routes, and cache logic
* 1ab887f refactor: remove background wake word listener
* 31a3172 feat: add pickup-only mode support
* 9b14d83 feat: integrate local Lottie animations
* e699100 feat: implement dynamic trending searches and fix manifest
* 3d8089d feat: improve SEO and offline experience
* c8ce06f refactor: allow guest access to core navigation
* 09baa14 feat: add auditory feedback and improve UI animations
* 935c8a9 feat(checkout): add validation and shake animation
* 11d50ee perf: optimize asset delivery and AI latency
* b8e7ea5 perf: optimize application responsiveness and load times
* 6137dbd feat: add order status endpoints and cart animation
* a801810 feat: add robust storage polyfill and service logic
* b031ee1 feat: integrate backend queueing and UI enhancements
* ae96eb0 chore(release): bump version to 1.5 (build 6) [production]
* 14f3759 feat(auth): implement OTP queue and stability fixes
* d1672ba chore(release): bump version to 1.5 (build 6) [production]
* 8c10f76 refactor: standardize UTC time and update login UI
* 7c2db57 chore(release): bump version to 1.5 (build 6) [production]
* 9b27162 feat: implement OTP rate limiting and client stability
* e755906 chore(release): bump version to 1.5 (build 6) [production]
* 6473759 fix: improve auth stability and client recovery
* 9888fa9 chore(release): bump version to 1.5 (build 6) [production]
* 2db2141 feat(boot): implement boot sequence and BootProvider
* e18c690 chore(release): bump version to 1.5 (build 6) [production]
* 3c35055 feat(auth): implement OTP verification UI
* 3b3bfcf chore(release): bump version to 1.5 (build 6) [production]
* 1e53294 fix: improve SSR stability and WhatsApp local server
* 1609108 chore(release): bump version to 1.5 (build 6) [production]
* 4e573f8 fix(auth): improve local WhatsApp dispatch handling
* 3a8b495 chore(release): bump version to 1.5 (build 6) [production]
* 2f136ca feat(auth): implement dynamic WhatsApp dispatch
* b7804d3 chore(release): bump version to 1.5 (build 6) [production]
* 9ac3635 feat(auth): implement polling-based WhatsApp OTP delivery
* 7774c77 chore(release): bump version to 1.5 (build 6) [production]
* 8e25f41 feat: add push notifications and SMS support
* cc5beb1 chore(release): bump version to 1.5 (build 6) [production]
* 9d07287 fix(security): strengthen CSP and revert version
* 8a41f94 chore(release): bump version to 1.5 (build 6) [production]
* 1f461a0 fix: improve security and access control
* ab96046 chore(release): bump version to 1.5 (build 6) [production]
* 575d6d9 fix(admin): improve database schema fallback logic
* e1f2fef chore(release): bump version to 1.5 (build 6) [production]
* 2403f78 feat: optimize routing and update delivery display
* 24b416c chore(release): bump version to 1.5 (build 6) [production]
* e4b8102 feat: implement item delivery time and auth loading
* 7ca5d83 chore(release): bump version to 1.5 (build 6) [production]
* ff0f0e2 ui: enhance interactive elements with animations
* 217b6b3 chore(release): bump version to 1.5 (build 6) [production]
* ed06db2 refactor: improve performance and dependency management
* aae5954 chore(release): bump version to 1.5 (build 6) [production]
* bc2abea feat(auth): implement mobile OTP verification flow
* be36785 chore(release): bump version to 1.5 (build 6) [production]
* 941b4b8 feat: add real-time updates and request timeouts
* 7fab046 chore(release): bump version to 1.5 (build 6) [production]
* 4f41d21 chore: add debug endpoint and revert version
* 1298ac3 chore(release): bump version to 1.5 (build 6) [production]
* 6ce817c chore: revert version to 1.4.0
* aff9a90 chore(release): bump version to 1.5 (build 6) [production]
* 6f980fb chore: revert version to 1.4.0
* 81eeeec chore(release): bump version to 1.5 (build 6) [production]
* 276a3b2 build: refactor API entry point and revert version
* a93df57 chore(release): bump version to 1.5 (build 6) [production]
* 6171122 feat(checkout): add offline fallback for Cuttack address validation
* e07f04d chore(release): bump version to 1.5 (build 6) [production]
* 1b34352 fix: improve synchronization safety and data handling
* 57f580f build: update API build process and rollback version
* d12e4bd chore(release): bump version to 1.5 (build 6) [production]
* 1be9dbb fix(server): add Vercel path normalization middleware
* 5624820 chore(release): bump version to 1.5 (build 6) [production]
* 98cb204 fix(auth): implement dynamic session loading timeout
* 05aa978 chore(release): bump version to 1.5 (build 6) [production]
* 4f40d25 fix: improve CORS security and session loading
* 4d28e49 chore(release): bump version to 1.5 (build 6) [production]
* 52d6371 chore(release): revert to version 1.4.0
* 7c2e9ae chore(release): bump version to 1.5 (build 6) [production]
* bebbc18 refactor: improve address validation and add wake word
* fbb6be8 chore(release): bump version to 1.5 (build 6) [production]
* 6aca058 feat(butler): implement AI chat functionality
* aa417e8 chore(release): bump version to 1.5 (build 6) [production]
* 565e302 build: improve Android build and environment setup


All notable changes to the Frosty Bite application will be documented in this file.

## [1.5] - 2026-09-03 (PRODUCTION)
- **Build / Version Code**: `6`
- **Release Details**:
* e03c43e feat: sync latest updates, feedback management, order collected workflow, and admin enhancements
* 757f405 feat(admin): add bakery location management
* cf49578 feat: add pickup status workflow
* 1ae6ec0 refactor(upi): remove transaction reference from URI
* 61ae787 refactor: remove UPI dev diagnostics from checkout
* 8279dfd feat: standardize UPI transaction reference (tr)
* dcfa0c4 feat(upi): add diagnostic suite for UPI intent testing
* 10215ca fix(payment): improve reliability and data integrity
* 77f2670 fixed
* 071f19a fixed
* 2f3e0ad fixed
* 007f4f3 fixed phonepe issue
* c2d629c fixed 5
* 9916b83 fixed 4
* d9daf96 fixed3
* d8c904b refactor(checkout): unify auth token retrieval
* df4e6ae fixed
* 8f2508a fix : session management
* b55d6f0 payment session fixed
* c8954c7 fixed 2.0
* 6b40a9a fix: stabilize UPI timer and refresh logic
* 130c4f2 fixed
* 4f950ff fix: update UPI payment timer initialization
* abec4de fix: sync UPI timer with authoritative expiration
* 2d70078 fix(payment): add robust order ID sanitization
* 855eaa4 fix: improve order lookup and payment handling
* f910569 refactor: centralize brand logo management
* 068f1ad refactor: unify logo assets and improve payment auth
* cdcc7c0 feat: update branding to SVG logo
* e2b4631 refactor: update logo to use local asset path
* 57888dd fix(auth/orders): strengthen auth and sanitize database updates
* ff77d3f fix(payment): return 200 status for successful payments
* 540593a refactor: strengthen authentication and access control
* 9fd8a43 feat(payment): add back navigation and UI polish
* 8f8f5fb feat(payment): auto-convert COD/Cash to UPI for online payments
* 96827c4 fix: improve UPI payment status polling reliability
* 1777e7b fixed
* 8709c03 supabase configuration fixed
* c570c92 network error fixed
* bb6a68a fix: improve CommonJS module compatibility and build
* aeac19a build: bundle app separately for serverless deployment
* 81893c9 feat: integrate core application routes
* 84060d9 feat(payment): implement robust checkout recovery
* 609d82e feat: improve UPI payment robustness
* ce4fc0a feat(payment): enhance UPI checkout flow and security
* 7ec48d9 build: switch API runtime to bundled app artifact
* 2c01748 root cause fixed
* 7ca0ff0 build: improve Vercel deployment compatibility
* f64e76d chore: update vercel rewrites for api routing
* 1f78213 feat: update routes and improve rate limiting
* fa5d896 feat: implement payment verification system
* 645650e feat(payment): implement FrostyPay device event API
* fe1d2b5 refactor(auth): export UserRole and improve cache error logging
* 8469354 refactor(server): simplify Supabase client initialization
* 77dad8e refactor: improve environment variable security
* e21f355 feat(notifications): implement push notification system
* 82b3b1c feat: implement push notifications and reorder flow
* dbd8236 refactor: standardize order ID formatting
* 45027db feat: add scheduled delivery and cake customization
* d969e38 refactor: improve component key stability
* d92ab5d refactor(animations): improve animation system and assets
* 9c40504 refactor: improve Lottie data handling and retry logic
* 0cdf646 animation fixed
* 4b3bf45 Add WhatsApp order confirmation system
* 3a70b88 feat(admin): implement order cancellation reasons and delivery updates
* 39155a9 refactor: extract order cancellation logic to page component
* d753827 feat(admin): implement WhatsApp cancellation workflow
* 76c94f8 feat(auth): increase OTP length to 8 digits
* 5c58f9e feat: support dynamic OTP length and auth fallback
* 1ea2f3a refactor: remove OTP session resumption logic
* e421c53 refactor(auth): enforce 6-digit OTP delivery
* 72958e1 feat: implement lazy component loading with retries
* 596da4e feat(email): enforce 6-digit OTP format
* ada807c feat(auth): integrate OtpInput component
* dc23c45 fix: improve OTP dispatch reliability and error handling
* 30e06a5 feat(auth): transition to 6-digit custom email OTP
* e8af449 refactor: add FAQ navigation and optimize scroll logic
* 3c197d1 refactor: hide navbar on product pages
* 22b318a refactor: optimize authentication and component loading
* 8b75dae feat: add app versioning and update notification system
* 4bdb920 feat(notifications): standardize cross-platform notifications
* 30b1fa4 perf: optimize component rendering and loading
* abfc264 fix: calculate delivery fee correctly for pickups
* 5df674e feat: add guest wishlist support and UI skeletons
* e5450e7 feat(auth): disable mobile login and show coming soon toast
* ed38f98 feat: allow guest checkout by removing login wall
* 444a333 fix: improve app_settings update reliability
* f57f025 perf: implement lazy loading and checkout persistence
* 3296af7 fix: implement fallback for ordering status update
* c833eac fix(admin): improve menu item data parsing logic
* 24f484f feat(auth): implement unified getAuthToken method
* f640cfc chore: optimize build chunking strategy
* 9fb3ae5 chore: update .gitignore to include dist/
* ffc1da5 feat: add haptic feedback to logout action
* 0499d8e feat(guest): add convertToUser helper and export
* fe8e52a feat: implement guest profile persistence at checkout
* b228106 feat: implement guest user session and auth modal
* e131610 refactor: remove bloated compiled api/index.js
* 8357f3c feat: temporarily disable geofencing service
* a33fc3c feat(config): disable geofencing by default
* 7911658 feat(admin): implement slide-to-confirm for actions
* 55c5053 build: enable sourcemaps for server bundle
* ed90656 refactor: improve hook stability and state updates
* 1c5606d feat: add FAQ page and unify geofencing API routes
* 99135c0 build: refactor serverless API and environment loading
* 868473d refactor: migrate geofencing storage from Firestore to Supabase
* 0dc57c6 fix: update firebase-admin initialization
* 3a34147 fixxed all typescript error
* f9c8797 fixed type script
* 71681fb fixed typescript
* 4a29aba typescript error fixed
* f426d97 fixed typescript err0ors
* c4957e3 typescript error fix
* 8d7e47a vercel fixed
* 9cee1a0 updated files
* 0510031 chore(release): bump version to 1.5 (build 6) [production]
* 6287fcd updaated
* 44f2b56 chore(release): bump version to 1.5 (build 6) [production]
* 6a2439f update
* 15c765e chore(release): bump version to 1.5 (build 6) [production]
* acd8abc updated
* e0ff14c chore(release): bump version to 1.5 (build 6) [production]
* c6641e3 fixed
* 3ab5e74 chore(release): bump version to 1.5 (build 6) [production]
* df4ceb7 fised
* 28f7483 chore(release): bump version to 1.5 (build 6) [production]
* 7a7c140 official update
* 4dd45f1 chore(release): bump version to 1.5 (build 6) [production]
* 3d464c1 error fixed !!
* 16ce6a3 chore(release): bump version to 1.5 (build 6) [production]
* 97cbc50 fix the issue
* 4148e0a chore(release): bump version to 1.5 (build 6) [production]
* 7052aaa fix(geofencing): improve service area resilience
* 96f1cb6 chore(release): bump version to 1.5 (build 6) [production]
* 417024b feat(geofencing): enable upsert for existing cities
* 7f5e40e chore(release): bump version to 1.5 (build 6) [production]
* d4c6d63 fix: improve geofencing error reporting and version
* f2e3231 chore(release): bump version to 1.5 (build 6) [production]
* 5d94c24 fix: improve geofencing resilience and rollback
* 00b1982 chore(release): bump version to 1.5 (build 6) [production]
* be4072f chore(release): roll back version to 1.4
* 9286b95 chore(release): bump version to 1.5 (build 6) [production]
* 1a014b1 fix: improve geofencing resilience and rollback version
* efab765 chore(release): bump version to 1.5 (build 6) [production]
* 3b6bd21 chore: revert build changes and downgrade version
* 97b6129 chore(release): bump version to 1.5 (build 6) [production]
* 04f98a1 chore: improve build pipeline and service stability
* d458b23 chore(release): bump version to 1.5 (build 6) [production]
* 7755317 feat: upgrade AI models and enhance error handling
* 2ff9e90 chore(release): bump version to 1.5 (build 6) [production]
* 67614bf feat(geofencing): update Odisha service boundaries
* 25201a7 chore(release): bump version to 1.5 (build 6) [production]
* 1ae139f feat: implement geofencing v2 infrastructure
* 340e166 feat(orders): implement fallback for order insertion
* b59df1e chore: update AI model, API routes, and cache logic
* 1ab887f refactor: remove background wake word listener
* 31a3172 feat: add pickup-only mode support
* 9b14d83 feat: integrate local Lottie animations
* e699100 feat: implement dynamic trending searches and fix manifest
* 3d8089d feat: improve SEO and offline experience
* c8ce06f refactor: allow guest access to core navigation
* 09baa14 feat: add auditory feedback and improve UI animations
* 935c8a9 feat(checkout): add validation and shake animation
* 11d50ee perf: optimize asset delivery and AI latency
* b8e7ea5 perf: optimize application responsiveness and load times
* 6137dbd feat: add order status endpoints and cart animation
* a801810 feat: add robust storage polyfill and service logic
* b031ee1 feat: integrate backend queueing and UI enhancements
* ae96eb0 chore(release): bump version to 1.5 (build 6) [production]
* 14f3759 feat(auth): implement OTP queue and stability fixes
* d1672ba chore(release): bump version to 1.5 (build 6) [production]
* 8c10f76 refactor: standardize UTC time and update login UI
* 7c2db57 chore(release): bump version to 1.5 (build 6) [production]
* 9b27162 feat: implement OTP rate limiting and client stability
* e755906 chore(release): bump version to 1.5 (build 6) [production]
* 6473759 fix: improve auth stability and client recovery
* 9888fa9 chore(release): bump version to 1.5 (build 6) [production]
* 2db2141 feat(boot): implement boot sequence and BootProvider
* e18c690 chore(release): bump version to 1.5 (build 6) [production]
* 3c35055 feat(auth): implement OTP verification UI
* 3b3bfcf chore(release): bump version to 1.5 (build 6) [production]
* 1e53294 fix: improve SSR stability and WhatsApp local server
* 1609108 chore(release): bump version to 1.5 (build 6) [production]
* 4e573f8 fix(auth): improve local WhatsApp dispatch handling
* 3a8b495 chore(release): bump version to 1.5 (build 6) [production]
* 2f136ca feat(auth): implement dynamic WhatsApp dispatch
* b7804d3 chore(release): bump version to 1.5 (build 6) [production]
* 9ac3635 feat(auth): implement polling-based WhatsApp OTP delivery
* 7774c77 chore(release): bump version to 1.5 (build 6) [production]
* 8e25f41 feat: add push notifications and SMS support
* cc5beb1 chore(release): bump version to 1.5 (build 6) [production]
* 9d07287 fix(security): strengthen CSP and revert version
* 8a41f94 chore(release): bump version to 1.5 (build 6) [production]
* 1f461a0 fix: improve security and access control
* ab96046 chore(release): bump version to 1.5 (build 6) [production]
* 575d6d9 fix(admin): improve database schema fallback logic
* e1f2fef chore(release): bump version to 1.5 (build 6) [production]
* 2403f78 feat: optimize routing and update delivery display
* 24b416c chore(release): bump version to 1.5 (build 6) [production]
* e4b8102 feat: implement item delivery time and auth loading
* 7ca5d83 chore(release): bump version to 1.5 (build 6) [production]
* ff0f0e2 ui: enhance interactive elements with animations
* 217b6b3 chore(release): bump version to 1.5 (build 6) [production]
* ed06db2 refactor: improve performance and dependency management
* aae5954 chore(release): bump version to 1.5 (build 6) [production]
* bc2abea feat(auth): implement mobile OTP verification flow
* be36785 chore(release): bump version to 1.5 (build 6) [production]
* 941b4b8 feat: add real-time updates and request timeouts
* 7fab046 chore(release): bump version to 1.5 (build 6) [production]
* 4f41d21 chore: add debug endpoint and revert version
* 1298ac3 chore(release): bump version to 1.5 (build 6) [production]
* 6ce817c chore: revert version to 1.4.0
* aff9a90 chore(release): bump version to 1.5 (build 6) [production]
* 6f980fb chore: revert version to 1.4.0
* 81eeeec chore(release): bump version to 1.5 (build 6) [production]
* 276a3b2 build: refactor API entry point and revert version
* a93df57 chore(release): bump version to 1.5 (build 6) [production]
* 6171122 feat(checkout): add offline fallback for Cuttack address validation
* e07f04d chore(release): bump version to 1.5 (build 6) [production]
* 1b34352 fix: improve synchronization safety and data handling
* 57f580f build: update API build process and rollback version
* d12e4bd chore(release): bump version to 1.5 (build 6) [production]
* 1be9dbb fix(server): add Vercel path normalization middleware
* 5624820 chore(release): bump version to 1.5 (build 6) [production]
* 98cb204 fix(auth): implement dynamic session loading timeout
* 05aa978 chore(release): bump version to 1.5 (build 6) [production]
* 4f40d25 fix: improve CORS security and session loading
* 4d28e49 chore(release): bump version to 1.5 (build 6) [production]
* 52d6371 chore(release): revert to version 1.4.0
* 7c2e9ae chore(release): bump version to 1.5 (build 6) [production]
* bebbc18 refactor: improve address validation and add wake word
* fbb6be8 chore(release): bump version to 1.5 (build 6) [production]
* 6aca058 feat(butler): implement AI chat functionality
* aa417e8 chore(release): bump version to 1.5 (build 6) [production]
* 565e302 build: improve Android build and environment setup
