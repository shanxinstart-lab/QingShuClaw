import { describe, expect, test } from 'vitest';

import { getCommandDangerLevel, isDangerousCommand, isDeleteCommand } from './commandSafety';

describe('commandSafety', () => {
  test('detects common delete commands', () => {
    expect(isDeleteCommand('rm file.txt')).toBe(true);
    expect(isDeleteCommand('rm -i obsolete.log')).toBe(true);
    expect(isDeleteCommand('rmdir /tmp/build')).toBe(true);
    expect(isDeleteCommand('unlink /var/run/app.pid')).toBe(true);
    expect(isDeleteCommand('del C:\\Users\\foo\\bar.txt')).toBe(true);
    expect(isDeleteCommand('erase temp.dat')).toBe(true);
    expect(isDeleteCommand('Remove-Item -Path C:\\Logs\\*.log')).toBe(true);
    expect(isDeleteCommand('trash ~/Downloads/old-report.pdf')).toBe(true);
    expect(isDeleteCommand('find . -name "*.tmp" -delete')).toBe(true);
    expect(isDeleteCommand('git clean -fd')).toBe(true);
    expect(isDeleteCommand('git clean -fdx')).toBe(true);
    expect(isDeleteCommand('osascript -e \'tell application "Finder" to delete POSIX file "/tmp/old.txt"\'')).toBe(true);
  });

  test('does not classify read-only commands as delete commands', () => {
    expect(isDeleteCommand('ls -la /tmp')).toBe(false);
    expect(isDeleteCommand('git push origin main')).toBe(false);
    expect(isDeleteCommand('echo "hello world"')).toBe(false);
    expect(isDeleteCommand('npm install react')).toBe(false);
    expect(isDeleteCommand('cat /etc/hosts')).toBe(false);
  });

  test('detects destructive and caution commands', () => {
    expect(isDangerousCommand('rm -rf /tmp/old')).toBe(true);
    expect(isDangerousCommand('git push origin main')).toBe(true);
    expect(isDangerousCommand('git push -u origin feat/my-branch')).toBe(true);
    expect(isDangerousCommand('git reset --hard HEAD~1')).toBe(true);
    expect(isDangerousCommand('kill -9 12345')).toBe(true);
    expect(isDangerousCommand('killall node')).toBe(true);
    expect(isDangerousCommand('pkill -f my-server')).toBe(true);
    expect(isDangerousCommand('chmod 777 /usr/local/bin/app')).toBe(true);
    expect(isDangerousCommand('chown root:root /etc/shadow')).toBe(true);
  });

  test('allows safe read-only commands', () => {
    expect(isDangerousCommand('ls -la')).toBe(false);
    expect(isDangerousCommand('cat README.md')).toBe(false);
    expect(isDangerousCommand('npm install')).toBe(false);
    expect(isDangerousCommand('git status')).toBe(false);
    expect(isDangerousCommand('git log --oneline -10')).toBe(false);
  });

  test('reports destructive command levels', () => {
    expect(getCommandDangerLevel('rm -rf /tmp/old')).toEqual({
      level: 'destructive',
      reason: 'recursive-delete',
    });
    expect(getCommandDangerLevel('rm -r build/')).toEqual({
      level: 'destructive',
      reason: 'recursive-delete',
    });
    expect(getCommandDangerLevel('rm --recursive dist/')).toEqual({
      level: 'destructive',
      reason: 'recursive-delete',
    });
    expect(getCommandDangerLevel('git push --force origin main')).toEqual({
      level: 'destructive',
      reason: 'git-force-push',
    });
    expect(getCommandDangerLevel('git push -f origin feat/fix')).toEqual({
      level: 'destructive',
      reason: 'git-force-push',
    });
    expect(getCommandDangerLevel('git reset --hard HEAD~3')).toEqual({
      level: 'destructive',
      reason: 'git-reset-hard',
    });
    expect(getCommandDangerLevel('dd if=/dev/zero of=/dev/sda bs=512')).toEqual({
      level: 'destructive',
      reason: 'disk-overwrite',
    });
    expect(getCommandDangerLevel('mkfs.ext4 /dev/sdb1')).toEqual({
      level: 'destructive',
      reason: 'disk-format',
    });
  });

  test('reports caution command levels', () => {
    expect(getCommandDangerLevel('rm old-file.txt')).toEqual({
      level: 'caution',
      reason: 'file-delete',
    });
    expect(getCommandDangerLevel('find /tmp -name "*.log" -mtime +7 -delete')).toEqual({
      level: 'caution',
      reason: 'file-delete',
    });
    expect(getCommandDangerLevel('git clean -fd')).toEqual({
      level: 'caution',
      reason: 'file-delete',
    });
    expect(getCommandDangerLevel('trash old-file.txt')).toEqual({
      level: 'caution',
      reason: 'file-delete',
    });
    expect(getCommandDangerLevel('osascript -e \'tell application "Finder" to delete POSIX file "/tmp/old.txt"\'')).toEqual({
      level: 'caution',
      reason: 'file-delete',
    });
    expect(getCommandDangerLevel('git push origin main')).toEqual({
      level: 'caution',
      reason: 'git-push',
    });
    expect(getCommandDangerLevel('kill -9 9876')).toEqual({
      level: 'caution',
      reason: 'process-kill',
    });
    expect(getCommandDangerLevel('chmod 755 deploy.sh')).toEqual({
      level: 'caution',
      reason: 'permission-change',
    });
    expect(getCommandDangerLevel('chown www-data:www-data /var/www/app')).toEqual({
      level: 'caution',
      reason: 'permission-change',
    });
  });

  test('reports safe command levels', () => {
    expect(getCommandDangerLevel('ls -la /tmp')).toEqual({ level: 'safe', reason: '' });
    expect(getCommandDangerLevel('git status')).toEqual({ level: 'safe', reason: '' });
    expect(getCommandDangerLevel('npm install lodash')).toEqual({ level: 'safe', reason: '' });
    expect(getCommandDangerLevel('echo "deployment complete"')).toEqual({ level: 'safe', reason: '' });
    expect(getCommandDangerLevel('')).toEqual({ level: 'safe', reason: '' });
  });
});
