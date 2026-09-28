import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {GoogleGenAI, Type} from '@google/genai';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'gemini-server-api',
        configureServer(server) {
          server.middlewares.use('/api/classify', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });

            req.on('end', async () => {
              res.setHeader('Content-Type', 'application/json');
              try {
                const { text, fewShotContext } = JSON.parse(body || '{}');

                if (!process.env.GEMINI_API_KEY) {
                  res.end(JSON.stringify({ useLocalFallback: true, reason: 'NO_API_KEY' }));
                  return;
                }

                const ai = new GoogleGenAI({
                  apiKey: process.env.GEMINI_API_KEY,
                  httpOptions: {
                    headers: {
                      'User-Agent': 'aistudio-build',
                    },
                  },
                });

                const systemInstruction = `你是一名专业的新能源车企 App 产品经理，负责将用户反馈多维分类。
关键原则：
1. "用户说的是症状，不是解决方案"：例如"能不能加个一键充电按钮" -> 提炼为「充电模块 / 效率摩擦 / 充电扫码路径过深」，而非直接记成"加按钮"。
2. 严重程度判据：
   - 阻断：涉及资金损失、安全、车辆控制失效（如远程解锁失败、钱扣了未启动充电、暴风雪被锁车外、蓝牙钥匙离线失效）。
   - 高：核心流程走不通，但有替代方案。
   - 中：体验明显变差但不影响任务完成。
   - 低：建议 / 锦上添花。
3. 复核路由条件：如果是阻断级，或置信度低于75%，或同时涉及多个跨模块问题，needsReview设为true。

${fewShotContext || ''}`;

                const response = await ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: `请对以下车企App用户反馈进行专业产品维度分类与诊断：\n"${text}"`,
                  config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        module: {
                          type: Type.STRING,
                          description: '车控 | 导航 | 充电 | 社区 | 商城 | 账号',
                        },
                        issueType: {
                          type: Type.STRING,
                          description: 'Bug | 体验摩擦 | 功能请求 | 咨询 | 表扬',
                        },
                        severity: {
                          type: Type.STRING,
                          description: '阻断 | 高 | 中 | 低',
                        },
                        sentiment: {
                          type: Type.STRING,
                          description: '强烈负面 | 负面 | 中性 | 正面',
                        },
                        symptomSummary: {
                          type: Type.STRING,
                          description: '基于用户处境提炼的真实症状，非盲从用户提议',
                        },
                        agentReasoning: {
                          type: Type.STRING,
                          description: '简明扼要的自然语言分类理由，供PM扫一眼即可确认',
                        },
                        confidence: {
                          type: Type.INTEGER,
                          description: '0到100的置信度',
                        },
                        needsReview: {
                          type: Type.BOOLEAN,
                          description: '是否需要主动路由人工复核',
                        },
                        reviewReason: {
                          type: Type.STRING,
                          description: 'blocker_safety | low_confidence | cross_category | cluster_anomaly | none',
                        },
                      },
                      required: [
                        'module',
                        'issueType',
                        'severity',
                        'sentiment',
                        'symptomSummary',
                        'agentReasoning',
                        'confidence',
                        'needsReview',
                        'reviewReason',
                      ],
                    },
                  },
                });

                res.end(response.text);
              } catch (err: any) {
                console.error('Gemini server API error:', err);
                res.end(JSON.stringify({ useLocalFallback: true, error: err?.message }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
