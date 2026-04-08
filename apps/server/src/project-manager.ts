/**
 * ProjectManager — tracks which project directory is currently open.
 */
export class ProjectManager {
  private projectDir: string | null = null;

  getProjectDir(): string | null {
    return this.projectDir;
  }

  setProjectDir(dir: string) {
    this.projectDir = dir;
  }

  clear() {
    this.projectDir = null;
  }
}
