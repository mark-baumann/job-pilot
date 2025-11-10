import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export default async function handler(req, res) {
  try {
    const { stdout, stderr } = await execAsync("npm run test:e2e");
    if (stderr) {
      res.status(500).json({ message: stderr });
      return;
    }
    res.status(200).json({ message: stdout });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
