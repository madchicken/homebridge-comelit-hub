import {Queue} from './queue';

class DeferredPromise<T> {
    readonly promise: Promise<T>;
    resolve: (value?: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

export interface DeferredMessage<M, R> {
    message: M;
    promise: DeferredPromise<R>;
}

export abstract class PromiseBasedQueue<M, R> implements Queue<M, R> {
    private readonly queuedMessages: DeferredMessage<M, R>[];

    constructor() {
        this.queuedMessages = [];
    }

    abstract processResponse(messages: DeferredMessage<M, R>[], response: R): void;

    flush(): void {
        this.queuedMessages.length = 0;
    }

    processQueue(response: R) {
        this.processResponse(this.queuedMessages, response);
    }

    enqueue(message: M): Promise<R> {
        const promise = new DeferredPromise<R>();
        this.queuedMessages.push({ message, promise });
        return promise.promise;
    }
}
