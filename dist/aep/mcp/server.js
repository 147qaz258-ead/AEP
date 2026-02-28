/**
 * AEP MCP Server
 *
 * 让 Claude Code 可以通过 MCP 协议使用 AEP 功能：
 * - aep_search: 搜索历史经验
 * - aep_record: 记录新经验
 * - aep_list: 列出会话摘要
 * - aep_stats: 查看统计信息
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
// 获取工作目录
const workspace = process.env.AEP_WORKSPACE || process.cwd();
const aepDir = path.join(workspace, '.aep');
const sessionsDir = path.join(aepDir, 'sessions');
const memoryDir = path.join(aepDir, 'memory');
// 确保目录存在
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
ensureDir(sessionsDir);
ensureDir(memoryDir);
// 简单的信号提取
function extractSignals(text) {
    const signals = new Set();
    // 提取关键词
    const keywords = [
        'error', 'TypeError', 'ReferenceError', 'SyntaxError',
        'typescript', 'javascript', 'python', 'rust', 'go',
        'config', 'install', 'build', 'test', 'deploy',
        'auth', 'api', 'database', 'network', 'timeout'
    ];
    const lowerText = text.toLowerCase();
    for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
            signals.add(keyword);
        }
    }
    // 提取工具名
    const toolPattern = /tool[:\s]+(\w+)/gi;
    let match;
    while ((match = toolPattern.exec(text)) !== null) {
        signals.add(`tool:${match[1]}`);
    }
    return Array.from(signals);
}
// 计算相似度
function calculateSimilarity(querySignals, docSignals) {
    if (querySignals.length === 0 || docSignals.length === 0)
        return 0;
    const querySet = new Set(querySignals.map(s => s.toLowerCase()));
    const docSet = new Set(docSignals.map(s => s.toLowerCase()));
    let overlap = 0;
    for (const s of querySet) {
        if (docSet.has(s))
            overlap++;
    }
    return overlap / Math.sqrt(querySet.size * docSet.size);
}
// 创建 MCP 服务器
const server = new Server({
    name: 'aep-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// 定义工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'aep_search',
                description: `搜索历史经验，找到类似问题的解决方案。

使用场景：
- 遇到错误时，搜索是否有类似问题的解决经验
- 想知道项目中某个问题之前是怎么解决的
- 查找特定类型的解决方案

返回：匹配的经验列表，包含问题描述和解决方案。`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: '问题描述或关键词',
                        },
                        limit: {
                            type: 'number',
                            description: '返回结果数量，默认 5',
                            default: 5,
                        },
                    },
                    required: ['query'],
                },
            },
            {
                name: 'aep_record',
                description: `记录新的经验，供未来使用。

使用场景：
- 解决了一个新问题，想记录下来
- 发现了一个有用的模式或最佳实践
- 踩了一个坑，想提醒未来的自己`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        problem: {
                            type: 'string',
                            description: '遇到的问题描述',
                        },
                        solution: {
                            type: 'string',
                            description: '解决方案',
                        },
                        signals: {
                            type: 'array',
                            items: { type: 'string' },
                            description: '相关关键词',
                        },
                    },
                    required: ['problem', 'solution'],
                },
            },
            {
                name: 'aep_list',
                description: `列出所有会话摘要。`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'number',
                            description: '返回结果数量，默认 10',
                            default: 10,
                        },
                    },
                },
            },
            {
                name: 'aep_stats',
                description: `查看 AEP 使用统计。`,
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
        ],
    };
});
// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case 'aep_search': {
            const { query, limit = 5 } = args;
            // 提取查询信号
            const querySignals = extractSignals(query);
            // 读取所有摘要
            const files = fs.existsSync(memoryDir)
                ? fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'))
                : [];
            if (files.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `没有找到任何历史经验。

使用 aep_record 记录第一个经验！

查询信号: ${querySignals.join(', ') || '无'}`,
                        }],
                };
            }
            // 匹配经验
            const matches = [];
            for (const file of files) {
                const filePath = path.join(memoryDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const docSignals = extractSignals(content);
                const score = calculateSimilarity(querySignals, docSignals);
                if (score > 0) {
                    matches.push({
                        file: file.replace('_summary.md', ''),
                        score,
                        content: content.substring(0, 800),
                    });
                }
            }
            // 排序并返回 top N
            matches.sort((a, b) => b.score - a.score);
            const topMatches = matches.slice(0, limit);
            if (topMatches.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: `没有找到与 "${query}" 相关的经验。

建议：
1. 尝试不同的关键词
2. 使用 aep_record 记录新经验

查询信号: ${querySignals.join(', ')}`,
                        }],
                };
            }
            const result = topMatches
                .map((m, i) => `## 匹配 ${i + 1} (相关度: ${(m.score * 100).toFixed(0)}%)\n\n${m.content}`)
                .join('\n\n---\n\n');
            return {
                content: [{ type: 'text', text: result }],
            };
        }
        case 'aep_record': {
            const { problem, solution, signals = [] } = args;
            // 提取信号
            const extractedSignals = extractSignals(`${problem} ${solution}`);
            const allSignals = [...new Set([...signals, ...extractedSignals])];
            // 生成 ID
            const id = `exp_${Date.now()}`;
            const timestamp = new Date().toISOString();
            // 创建 Markdown 摘要
            const markdown = `# 经验: ${problem.substring(0, 50)}...

**创建时间**: ${timestamp}
**信号**: ${allSignals.join(', ')}

## 问题

${problem}

## 解决方案

${solution}

## 元数据

- ID: ${id}
- 信号: ${JSON.stringify(allSignals)}
`;
            // 保存到 memory 目录
            const filePath = path.join(memoryDir, `${id}_summary.md`);
            fs.writeFileSync(filePath, markdown, 'utf-8');
            return {
                content: [{
                        type: 'text',
                        text: `✅ 经验已记录！

**问题**: ${problem.substring(0, 100)}${problem.length > 100 ? '...' : ''}
**解决方案**: ${solution.substring(0, 100)}${solution.length > 100 ? '...' : ''}
**信号**: ${allSignals.join(', ')}
**ID**: ${id}

这个经验可以在未来遇到类似问题时被检索到。`,
                    }],
            };
        }
        case 'aep_list': {
            const { limit = 10 } = args;
            const files = fs.existsSync(memoryDir)
                ? fs.readdirSync(memoryDir)
                    .filter(f => f.endsWith('.md'))
                    .map(f => {
                    const filePath = path.join(memoryDir, f);
                    const stats = fs.statSync(filePath);
                    return { name: f, mtime: stats.mtime };
                })
                    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
                    .slice(0, limit)
                : [];
            if (files.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: '没有任何历史会话记录。\n\n使用 aep_record 开始记录第一个经验！',
                        }],
                };
            }
            const result = files
                .map((f, i) => `${i + 1}. **${f.name.replace('_summary.md', '')}** (${f.mtime.toISOString().split('T')[0]})`)
                .join('\n');
            return {
                content: [{ type: 'text', text: `## 历史经验 (${files.length} 条)\n\n${result}` }],
            };
        }
        case 'aep_stats': {
            const sessionsSize = fs.existsSync(sessionsDir)
                ? fs.readdirSync(sessionsDir).reduce((sum, f) => {
                    const stats = fs.statSync(path.join(sessionsDir, f));
                    return sum + (stats.isFile() ? stats.size : 0);
                }, 0)
                : 0;
            const memorySize = fs.existsSync(memoryDir)
                ? fs.readdirSync(memoryDir).reduce((sum, f) => {
                    const stats = fs.statSync(path.join(memoryDir, f));
                    return sum + (stats.isFile() ? stats.size : 0);
                }, 0)
                : 0;
            const sessionCount = fs.existsSync(sessionsDir)
                ? fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl')).length
                : 0;
            const summaryCount = fs.existsSync(memoryDir)
                ? fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')).length
                : 0;
            const result = `## AEP 统计信息

**存储使用**:
- 会话目录: ${(sessionsSize / 1024).toFixed(2)} KB
- 摘要目录: ${(memorySize / 1024).toFixed(2)} KB

**记录数量**:
- 会话文件: ${sessionCount}
- 经验摘要: ${summaryCount}

**工作目录**: ${workspace}`;
            return {
                content: [{ type: 'text', text: result }],
            };
        }
        default:
            return {
                content: [{ type: 'text', text: `未知工具: ${name}` }],
            };
    }
});
// 启动服务器
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('AEP MCP Server started');
}
main().catch(console.error);
//# sourceMappingURL=server.js.map