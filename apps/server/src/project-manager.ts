/**
 * ProjectManager — tracks which project directory is currently open.
 */
import * as path from 'path';

export class ProjectManager {
  private projectDir: string | null = null;

  getProjectDir(): string | null {
    return this.projectDir;
  }

  setProjectDir(dir: string) {
    this.projectDir = path.resolve(dir);
  }

  clear() {
    this.projectDir = null;
  }

  isWithinProject(targetPath: string): boolean {
    if (!this.projectDir) return false;

    const relative = path.relative(this.projectDir, path.resolve(targetPath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }

  resolvePath(filePath: string): string | null {
    if (!this.projectDir) return null;

    const resolved = path.resolve(this.projectDir, filePath);
    return this.isWithinProject(resolved) ? resolved : null;
  }

  toProjectPath(filePath: string): string {
    const resolved = path.resolve(filePath);
    if (!this.projectDir || !this.isWithinProject(resolved)) {
      return resolved;
    }

    return path.relative(this.projectDir, resolved);
  }
}
