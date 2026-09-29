# Architecture decisions

- Use `src/lib/officialBranding.ts` as the single source for the embedded official logo in generated Word and Excel files, so exports work offline and branding remains consistent.
- Use semantic green-and-gold design tokens and the bento dashboard pattern as the shared application shell, so all modules retain one institutional visual identity.