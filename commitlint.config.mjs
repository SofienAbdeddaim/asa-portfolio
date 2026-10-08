export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    // Bots (Dependabot, release-please) paste long URLs and changelogs into the body.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
