import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as tools from "./tools.js";

const server = new Server(
  {
    name: "pet-life-manager",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * List available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_pets",
        description: "List all pets in the household",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_pet_details",
        description: "Get full details for a specific pet including schedules and health history",
        inputSchema: {
          type: "object",
          properties: { petId: { type: "string" } },
          required: ["petId"],
        },
      },
      {
        name: "add_feeding_log",
        description: "Log that a pet was fed",
        inputSchema: {
          type: "object",
          properties: {
            petId: { type: "string" },
            scheduleId: { type: "string", description: "Optional schedule ID" },
            userId: { type: "string", description: "The ID of the user logging the action" },
            amount: { type: "string" },
            foodType: { type: "string" },
          },
          required: ["petId", "userId", "amount", "foodType"],
        },
      },
      {
        name: "log_weight",
        description: "Record a weight entry for a pet",
        inputSchema: {
          type: "object",
          properties: {
            petId: { type: "string" },
            userId: { type: "string" },
            weight: { type: "number", description: "Weight in kg" },
            notes: { type: "string" },
          },
          required: ["petId", "userId", "weight"],
        },
      },
      {
        name: "get_household_activity",
        description: "Get a summary of recent pet care activity across the household",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_health_trends",
        description: "Get a summary of health logs (weight, medication) to identify trends",
        inputSchema: {
          type: "object",
          properties: { petId: { type: "string" } },
          required: ["petId"],
        },
      },
    ],
  };
});

/**
 * Handle tool calls.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_pets":
        return { content: [{ type: "text", text: JSON.stringify(await tools.listPets(), null, 2) }] };
      
      case "get_pet_details":
        return { content: [{ type: "text", text: JSON.stringify(await tools.getPetDetails((args as any).petId), null, 2) }] };
      
      case "add_feeding_log": {
        const a = args as any;
        return { content: [{ type: "text", text: JSON.stringify(await tools.addFeedingLog(a.petId, a.scheduleId, a.userId, a.amount, a.foodType), null, 2) }] };
      }

      case "log_weight": {
        const a = args as any;
        return { content: [{ type: "text", text: JSON.stringify(await tools.logWeight(a.petId, a.userId, a.weight, a.notes), null, 2) }] };
      }

      case "get_household_activity":
        return { content: [{ type: "text", text: JSON.stringify(await tools.getHouseholdActivity(), null, 2) }] };

      case "get_health_trends":
        return { content: [{ type: "text", text: JSON.stringify(await tools.getHealthTrends((args as any).petId), null, 2) }] };

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

/**
 * List available resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      { uri: "pets://list", name: "Full Household Pet List", mimeType: "application/json" },
    ],
  };
});

/**
 * Read a resource.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  if (uri === "pets://list") {
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(await tools.listPets(), null, 2) }],
    };
  }
  throw new Error(`Resource not found: ${uri}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pet Life Manager MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
