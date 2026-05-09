/**
 * Unit tests for commandSafety.ts.
 *
 * The pure helpers classify shell commands by destructive side effects:
 * - isDeleteCommand detects delete operations.
 * - isDangerousCommand includes delete, push, reset, process and permission operations.
 * - getCommandDangerLevel returns a warning level plus a short reason.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  getCommandDangerLevel,
  isDangerousCommand,
  isDeleteCommand,
} = require('../dist-electron/main/libs/commandSafety.js');

test('isDeleteCommand detects common delete commands', () => {
  assert.equal(isDeleteCommand('rm file.txt'), true);
  assert.equal(isDeleteCommand('rm -i obsolete.log'), true);
  assert.equal(isDeleteCommand('rmdir /tmp/build'), true);
  assert.equal(isDeleteCommand('unlink /var/run/app.pid'), true);
  assert.equal(isDeleteCommand('del C:\\Users\\foo\\bar.txt'), true);
  assert.equal(isDeleteCommand('erase temp.dat'), true);
  assert.equal(isDeleteCommand('Remove-Item -Path C:\\Logs\\*.log'), true);
  assert.equal(isDeleteCommand('find . -name "*.tmp" -delete'), true);
  assert.equal(isDeleteCommand('git clean -fd'), true);
  assert.equal(isDeleteCommand('git clean -fdx'), true);
});

test('isDeleteCommand does not flag safe commands', () => {
  assert.equal(isDeleteCommand('ls -la /tmp'), false);
  assert.equal(isDeleteCommand('git push origin main'), false);
  assert.equal(isDeleteCommand('echo "hello world"'), false);
  assert.equal(isDeleteCommand('npm install react'), false);
  assert.equal(isDeleteCommand('cat /etc/hosts'), false);
});

test('isDangerousCommand detects destructive and caution commands', () => {
  assert.equal(isDangerousCommand('rm -rf /tmp/old'), true);
  assert.equal(isDangerousCommand('git push origin main'), true);
  assert.equal(isDangerousCommand('git push -u origin feat/my-branch'), true);
  assert.equal(isDangerousCommand('git reset --hard HEAD~1'), true);
  assert.equal(isDangerousCommand('kill -9 12345'), true);
  assert.equal(isDangerousCommand('killall node'), true);
  assert.equal(isDangerousCommand('pkill -f my-server'), true);
  assert.equal(isDangerousCommand('chmod 777 /usr/local/bin/app'), true);
  assert.equal(isDangerousCommand('chown root:root /etc/shadow'), true);
});

test('isDangerousCommand allows safe read-only commands', () => {
  assert.equal(isDangerousCommand('ls -la'), false);
  assert.equal(isDangerousCommand('cat README.md'), false);
  assert.equal(isDangerousCommand('npm install'), false);
  assert.equal(isDangerousCommand('git status'), false);
  assert.equal(isDangerousCommand('git log --oneline -10'), false);
});

test('getCommandDangerLevel reports destructive commands', () => {
  assert.deepEqual(getCommandDangerLevel('rm -rf /tmp/old'), {
    level: 'destructive',
    reason: 'recursive-delete',
  });
  assert.deepEqual(getCommandDangerLevel('rm -r build/'), {
    level: 'destructive',
    reason: 'recursive-delete',
  });
  assert.deepEqual(getCommandDangerLevel('rm --recursive dist/'), {
    level: 'destructive',
    reason: 'recursive-delete',
  });
  assert.deepEqual(getCommandDangerLevel('git push --force origin main'), {
    level: 'destructive',
    reason: 'git-force-push',
  });
  assert.deepEqual(getCommandDangerLevel('git push -f origin feat/fix'), {
    level: 'destructive',
    reason: 'git-force-push',
  });
  assert.deepEqual(getCommandDangerLevel('git reset --hard HEAD~3'), {
    level: 'destructive',
    reason: 'git-reset-hard',
  });
  assert.deepEqual(getCommandDangerLevel('dd if=/dev/zero of=/dev/sda bs=512'), {
    level: 'destructive',
    reason: 'disk-overwrite',
  });
  assert.deepEqual(getCommandDangerLevel('mkfs.ext4 /dev/sdb1'), {
    level: 'destructive',
    reason: 'disk-format',
  });
});

test('getCommandDangerLevel reports caution commands', () => {
  assert.deepEqual(getCommandDangerLevel('rm old-file.txt'), {
    level: 'caution',
    reason: 'file-delete',
  });
  assert.deepEqual(getCommandDangerLevel('find /tmp -name "*.log" -mtime +7 -delete'), {
    level: 'caution',
    reason: 'file-delete',
  });
  assert.deepEqual(getCommandDangerLevel('git clean -fd'), {
    level: 'caution',
    reason: 'file-delete',
  });
  assert.deepEqual(getCommandDangerLevel('git push origin main'), {
    level: 'caution',
    reason: 'git-push',
  });
  assert.deepEqual(getCommandDangerLevel('kill -9 9876'), {
    level: 'caution',
    reason: 'process-kill',
  });
  assert.deepEqual(getCommandDangerLevel('chmod 755 deploy.sh'), {
    level: 'caution',
    reason: 'permission-change',
  });
  assert.deepEqual(getCommandDangerLevel('chown www-data:www-data /var/www/app'), {
    level: 'caution',
    reason: 'permission-change',
  });
});

test('getCommandDangerLevel reports safe commands', () => {
  assert.deepEqual(getCommandDangerLevel('ls -la /tmp'), {
    level: 'safe',
    reason: '',
  });
  assert.deepEqual(getCommandDangerLevel('git status'), {
    level: 'safe',
    reason: '',
  });
  assert.deepEqual(getCommandDangerLevel('npm install lodash'), {
    level: 'safe',
    reason: '',
  });
  assert.deepEqual(getCommandDangerLevel('echo "deployment complete"'), {
    level: 'safe',
    reason: '',
  });
  assert.deepEqual(getCommandDangerLevel(''), {
    level: 'safe',
    reason: '',
  });
});
