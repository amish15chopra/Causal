import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

import { AnalysisOrchestrator } from './application/services/analysisOrchestrator';

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Production route tunneling directly to the central Orchestrator
const orchestrator = new AnalysisOrchestrator();

app.post('/analyze', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { event } = req.body;
    if (!event) {
      res.status(400).json({ error: 'Missing event field in request body' });
      return;
    }
    const result = await orchestrator.orchestrate(event);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
});

app.post('/expand', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { nodeId, nodeText } = req.body;
    if (!nodeId || !nodeText) {
      res.status(400).json({ error: 'Missing nodeId or nodeText in request body' });
      return;
    }
    const result = await orchestrator.expandCausalNode(nodeId, nodeText);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
