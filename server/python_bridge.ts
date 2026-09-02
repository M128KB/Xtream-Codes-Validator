import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getAccounts, getUserDatabasePath } from './db.js';

const PYTHON_APP_DIR = path.join(process.cwd(), 'python_app');

export function getPythonSourceCode(filename: string): string {
  const filePath = path.join(PYTHON_APP_DIR, filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

export function executePythonValidation(
  inputLines: string,
  options: { threads?: number; timeout?: number; saveAll?: boolean } = {},
  userId?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    // Write temporary input file
    const tempInputPath = path.join(process.cwd(), 'data', `temp_input_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);
    fs.writeFileSync(tempInputPath, inputLines, 'utf-8');

    const dbPath = getUserDatabasePath(userId);
    const cliScript = path.join(PYTHON_APP_DIR, 'xtream_cli.py');

    const args = [
      cliScript,
      '--file', tempInputPath,
      '--db', dbPath,
      '--threads', String(options.threads || 10),
      '--timeout', String(options.timeout || 8)
    ];

    if (options.saveAll) {
      args.push('--save-all');
    }

    const pyProcess = spawn('python3', args, {
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pyProcess.on('close', (code) => {
      // Clean up temp file
      try {
        if (fs.existsSync(tempInputPath)) {
          fs.unlinkSync(tempInputPath);
        }
      } catch {
        // ignore
      }
      resolve({
        stdout,
        stderr,
        exitCode: code || 0
      });
    });
  });
}

export function generateExportData(
  format: 'm3u' | 'csv' | 'txt' | 'json',
  filterStatus: string = 'Valid',
  userId?: string,
  appUrl?: string,
  appName?: string
): { data: string; contentType: string; filename: string } {
  const accounts = getAccounts({ status: filterStatus }, userId);
  const resolvedAppName = appName || 'Xtream Codes Validator & Database Desktop';
  const resolvedAppUrl = appUrl || 'https://ais-pre-ken7kimogwkm2stztsoul5-383104743218.europe-west2.run.app';

  if (format === 'm3u') {
    let m3u = '#EXTM3U\n';
    for (const acc of accounts) {
      if (acc.is_valid || filterStatus === 'All') {
        const title = `${acc.domain.replace(/^https?:\/\//, '')} (${acc.username})`;
        m3u += `#EXTINF:-1 tvg-name="${acc.domain}" group-title="Xtream Accounts", ${title}\n`;
        m3u += `${acc.domain}/get.php?username=${encodeURIComponent(acc.username)}&password=${encodeURIComponent(acc.password)}&type=m3u_plus&output=ts\n`;
      }
    }
    return {
      data: m3u,
      contentType: 'audio/x-mpegurl',
      filename: `xtream_accounts_${filterStatus.toLowerCase()}.m3u`
    };
  }

  if (format === 'csv') {
    let csv = 'Domain,Username,Password,Status,IsValid,ExpDate,MaxConnections,ActiveCons,Timezone,LastChecked\n';
    for (const acc of accounts) {
      csv += `"${acc.domain}","${acc.username}","${acc.password}","${acc.status}",${acc.is_valid ? 1 : 0},"${acc.exp_date || ''}",${acc.max_connections || 0},${acc.active_cons || 0},"${acc.timezone || ''}","${acc.last_checked || ''}"\n`;
    }
    return {
      data: csv,
      contentType: 'text/csv',
      filename: `xtream_accounts_${filterStatus.toLowerCase()}.csv`
    };
  }

  if (format === 'json') {
    return {
      data: JSON.stringify(accounts, null, 2),
      contentType: 'application/json',
      filename: `xtream_accounts_${filterStatus.toLowerCase()}.json`
    };
  }

  // default TXT: Add app name and domain URL on the first line
  let txt = `# ${resolvedAppName} - ${resolvedAppUrl}\n# Xtream Codes Accounts (${filterStatus})\n# Format: domain username password\n\n`;
  for (const acc of accounts) {
    txt += `${acc.domain} ${acc.username} ${acc.password}\n`;
  }
  return {
    data: txt,
    contentType: 'text/plain',
    filename: `xtream_accounts_${filterStatus.toLowerCase()}.txt`
  };
}

