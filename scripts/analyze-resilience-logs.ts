import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, any>;
}

interface LogAnalysis {
  totalLogs: number;
  logLevels: Record<string, number>;
  responseTimes: {
    min: number;
    max: number;
    avg: number;
  };
  errors: {
    type: string;
    count: number;
    examples: string[];
  }[];
  endpoints: Record<string, {
    calls: number;
    errors: number;
    avgResponseTime: number;
  }>;
  timeDistribution: Record<string, number>;
}

function analyzeResilienceLogs(logFiles: string[]): LogAnalysis {
  const analysis: LogAnalysis = {
    totalLogs: 0,
    logLevels: {},
    responseTimes: {
      min: Infinity,
      max: -Infinity,
      avg: 0
    },
    errors: [],
    endpoints: {},
    timeDistribution: {}
  };

  let totalResponseTime = 0;
  let responseTimeCount = 0;
  const errorMap = new Map<string, { count: number; examples: Set<string> }>();

  for (const logFile of logFiles) {
    const logs = fs.readFileSync(logFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line) as LogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is LogEntry => entry !== null);

    for (const log of logs) {
      analysis.totalLogs++;
      analysis.logLevels[log.level] = (analysis.logLevels[log.level] || 0) + 1;

      // Analyze response times
      if (log.metadata?.responseTime) {
        const responseTime = log.metadata.responseTime;
        analysis.responseTimes.min = Math.min(analysis.responseTimes.min, responseTime);
        analysis.responseTimes.max = Math.max(analysis.responseTimes.max, responseTime);
        totalResponseTime += responseTime;
        responseTimeCount++;
      }

      // Analyze errors
      if (log.level === 'error') {
        const errorType = log.metadata?.error?.type || 'unknown';
        if (!errorMap.has(errorType)) {
          errorMap.set(errorType, { count: 0, examples: new Set() });
        }
        const errorInfo = errorMap.get(errorType)!;
        errorInfo.count++;
        errorInfo.examples.add(log.message);
      }

      // Analyze endpoints
      if (log.metadata?.endpoint) {
        const endpoint = log.metadata.endpoint;
        if (!analysis.endpoints[endpoint]) {
          analysis.endpoints[endpoint] = {
            calls: 0,
            errors: 0,
            avgResponseTime: 0
          };
        }
        analysis.endpoints[endpoint].calls++;
        if (log.level === 'error') {
          analysis.endpoints[endpoint].errors++;
        }
        if (log.metadata?.responseTime) {
          analysis.endpoints[endpoint].avgResponseTime = 
            (analysis.endpoints[endpoint].avgResponseTime * (analysis.endpoints[endpoint].calls - 1) + 
             log.metadata.responseTime) / analysis.endpoints[endpoint].calls;
        }
      }

      // Analyze time distribution
      const hour = new Date(log.timestamp).getHours();
      analysis.timeDistribution[hour] = (analysis.timeDistribution[hour] || 0) + 1;
    }
  }

  // Calculate average response time
  analysis.responseTimes.avg = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

  // Convert error map to array
  analysis.errors = Array.from(errorMap.entries()).map(([type, info]) => ({
    type,
    count: info.count,
    examples: Array.from(info.examples).slice(0, 5)
  }));

  return analysis;
}

function generateReport(analysis: LogAnalysis, outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate total logs report
  const totalLogsReport = [
    ['Metric', 'Value'],
    ['Total Logs', analysis.totalLogs.toString()],
    ['Min Response Time (ms)', analysis.responseTimes.min.toString()],
    ['Max Response Time (ms)', analysis.responseTimes.max.toString()],
    ['Avg Response Time (ms)', analysis.responseTimes.avg.toFixed(2)],
    ...Object.entries(analysis.logLevels).map(([level, count]) => [level, count.toString()])
  ].map(row => row.join(',')).join('\n');

  fs.writeFileSync(path.join(outputDir, 'total_logs.csv'), totalLogsReport);

  // Generate error types report
  const errorTypesReport = [
    ['Error Type', 'Count', 'Example Messages'],
    ...analysis.errors.map(error => [
      error.type,
      error.count.toString(),
      error.examples.join('; ')
    ])
  ].map(row => row.join(',')).join('\n');

  fs.writeFileSync(path.join(outputDir, 'error_types.csv'), errorTypesReport);

  // Generate endpoint performance report
  const endpointReport = [
    ['Endpoint', 'Total Calls', 'Errors', 'Error Rate (%)', 'Avg Response Time (ms)'],
    ...Object.entries(analysis.endpoints).map(([endpoint, stats]) => [
      endpoint,
      stats.calls.toString(),
      stats.errors.toString(),
      ((stats.errors / stats.calls) * 100).toFixed(2),
      stats.avgResponseTime.toFixed(2)
    ])
  ].map(row => row.join(',')).join('\n');

  fs.writeFileSync(path.join(outputDir, 'endpoint_performance.csv'), endpointReport);

  // Generate time distribution report
  const timeDistributionReport = [
    ['Hour', 'Log Count'],
    ...Object.entries(analysis.timeDistribution)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([hour, count]) => [hour, count.toString()])
  ].map(row => row.join(',')).join('\n');

  fs.writeFileSync(path.join(outputDir, 'time_distribution.csv'), timeDistributionReport);
}

async function main() {
  const logDir = process.env.LOG_DIR || 'logs';
  const outputDir = process.env.OUTPUT_DIR || 'reports';
  const logFiles = fs.readdirSync(logDir)
    .filter(file => file.endsWith('.log'))
    .map(file => path.join(logDir, file));

  console.log('Analyzing resilience test logs...');
  const analysis = analyzeResilienceLogs(logFiles);
  
  console.log('Generating reports...');
  generateReport(analysis, outputDir);
  
  console.log('Analysis complete! Reports generated in:', outputDir);
  console.log('\nSummary:');
  console.log(`Total Logs: ${analysis.totalLogs}`);
  console.log(`Error Rate: ${((analysis.logLevels.error || 0) / analysis.totalLogs * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${analysis.responseTimes.avg.toFixed(2)}ms`);
}

main().catch(console.error); 