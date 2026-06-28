import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { AgentCard, Task } from '@a2amesh/runtime';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(currentDirectory, '../proto/a2a.proto');

interface ProtoDescriptor {
  a2a: {
    v1: {
      A2AService: grpc.ServiceClientConstructor;
    };
  };
}

interface AgentCardResponse {
  json_card: string;
}

interface TaskResponse {
  task_json: string;
}

interface TaskRequest {
  task_id: string;
}

interface SendMessageRequest {
  message_text: string;
}

interface GrpcClientLike extends grpc.Client {
  GetAgentCard(
    request: Record<string, never>,
    callback: (error: grpc.ServiceError | null, response: AgentCardResponse) => void,
  ): void;
  SendMessage(
    request: SendMessageRequest,
    callback: (error: grpc.ServiceError | null, response: TaskResponse) => void,
  ): void;
  StreamMessage(request: SendMessageRequest): grpc.ClientReadableStream<TaskResponse>;
  GetTask(
    request: TaskRequest,
    callback: (error: grpc.ServiceError | null, response: TaskResponse) => void,
  ): void;
  CancelTask(
    request: TaskRequest,
    callback: (error: grpc.ServiceError | null, response: TaskResponse) => void,
  ): void;
}

export class GrpcClient {
  private readonly client: GrpcClientLike;

  constructor(address: string) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(
      packageDefinition,
    ) as unknown as ProtoDescriptor;
    const ClientConstructor = protoDescriptor.a2a.v1.A2AService;
    this.client = new ClientConstructor(
      address,
      grpc.credentials.createInsecure(),
    ) as unknown as GrpcClientLike;
  }

  async getAgentCard(): Promise<AgentCard> {
    return new Promise<AgentCard>((resolve, reject) => {
      this.client.GetAgentCard({}, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(JSON.parse(response.json_card) as AgentCard);
      });
    });
  }

  async sendMessage(messageText: string): Promise<Task | null> {
    return new Promise<Task | null>((resolve, reject) => {
      this.client.SendMessage({ message_text: messageText }, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(JSON.parse(response.task_json) as Task | null);
      });
    });
  }

  async *streamMessage(messageText: string): AsyncGenerator<Task> {
    const call = this.client.StreamMessage({ message_text: messageText });
    const queue: Task[] = [];
    let finished = false;
    let streamError: Error | undefined;
    let wake: (() => void) | undefined;

    const notify = () => {
      wake?.();
      wake = undefined;
    };

    call.on('data', (response) => {
      queue.push(JSON.parse(response.task_json) as Task);
      notify();
    });
    call.on('error', (error) => {
      streamError = error;
      finished = true;
      notify();
    });
    call.on('end', () => {
      finished = true;
      notify();
    });

    while (!finished || queue.length > 0) {
      const task = queue.shift();
      if (task) {
        yield task;
        continue;
      }

      if (streamError) {
        throw streamError;
      }

      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }

    if (streamError) {
      throw streamError;
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    return new Promise<Task | null>((resolve, reject) => {
      this.client.GetTask({ task_id: taskId }, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(JSON.parse(response.task_json) as Task | null);
      });
    });
  }

  async cancelTask(taskId: string): Promise<Task | null> {
    return new Promise<Task | null>((resolve, reject) => {
      this.client.CancelTask({ task_id: taskId }, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(JSON.parse(response.task_json) as Task | null);
      });
    });
  }

  close(): void {
    this.client.close();
  }
}
