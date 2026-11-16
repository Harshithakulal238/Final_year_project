import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pythonScript = path.resolve(__dirname, '../python/decision_tree_predict.py');

export function scoreRecommendationCandidates({ user, schemes }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ user, schemes });
    const pythonBinary = process.env.PYTHON_BIN || 'python';
    const child = spawn(pythonBinary, [pythonScript], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectOnce);
    child.stdin.on('error', rejectOnce);
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0 || !stdout.trim()) {
        return rejectOnce(new Error(stderr.trim() || `Python scoring exited with code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        if (!Array.isArray(parsed) || parsed.length !== schemes.length) {
          throw new Error('Python scoring returned an unexpected number of results');
        }
        for (const result of parsed) {
          if (!result.schemeId || !Number.isFinite(result.decisionTreeScore)) {
            throw new Error('Python scoring returned an invalid result');
          }
        }
        settled = true;
        resolve(parsed);
      } catch (error) {
        rejectOnce(new Error(`Unable to use Python scoring output: ${error.message}`));
      }
    });

    child.stdin.end(payload);
  });
}
