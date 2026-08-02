import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pythonScript = path.resolve(__dirname, '../python/decision_tree_predict.py');

export function scoreEligibleSchemes({ user, schemes }) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ user, schemes });
    const pythonBinary = process.env.PYTHON_BIN || 'python';

    const child = spawn(pythonBinary, [pythonScript], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        const fallback = (schemes || []).map((scheme) => ({
          source_url: scheme?.source_url || scheme?.scheme_url || scheme?.schemeName || scheme?.scheme_name || 'unknown',
          decisionTreeScore: 0.55,
        }));

        if (stderr) {
          console.warn('Python scoring failed:', stderr.trim());
        }

        return resolve(fallback);
      }

      try {
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
          return resolve(parsed);
        }

        return resolve([parsed]);
      } catch (error) {
        console.warn('Invalid Python output:', stdout);
        return resolve((schemes || []).map((scheme) => ({
          source_url: scheme?.source_url || scheme?.scheme_url || scheme?.schemeName || scheme?.scheme_name || 'unknown',
          decisionTreeScore: 0.5,
        })));
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}
