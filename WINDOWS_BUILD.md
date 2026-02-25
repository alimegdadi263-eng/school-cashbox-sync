# Windows EXE Build (Electron)

## 1) Build web app
```bash
npm run build
```

## 2) Run desktop app locally
```bash
npx electron electron/main.js
```

## 3) Build Windows installer (.exe)
```bash
npx electron-builder --win --config electron-builder.yml
```

The installer will be generated in:
- `release/`

## Notes
- In development mode, Electron opens `http://localhost:8080`.
- In production build, Electron opens `dist/index.html`.
- Because your backend is on Lovable Cloud, internet is required for full functionality.
