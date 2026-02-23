if (typeof window !== 'undefined' && !(window as any).chrome) {
    (window as any).chrome = {
        runtime: {
            sendMessage: (message: any, responseCallback?: any) => {
                console.log('Mock sendMessage:', message)
                if (message.type === 'ASK_SLM') {
                    setTimeout(() => {
                        responseCallback?.({
                            answer: `Local dev answer: This is a mock response from the SLM placeholder for "${message.payload.prompt}"`
                        })
                    }, 600)
                } else {
                    responseCallback?.({})
                }
            },
            onMessage: {
                addListener: () => { },
                removeListener: () => { }
            }
        },
        storage: {
            sync: {
                get: (_keys: any, callback: any) => callback({}),
                set: (items: any) => console.log('Mock storage set:', items)
            }
        },
        tabs: {
            query: (_query: any, callback: any) => callback([{ id: 1, title: 'Mock Tab', url: 'http://localhost' }]),
            sendMessage: (_tabId: any, message: any, callback?: any) => {
                console.log('Mock tab sendMessage:', message)
                callback?.({})
            }
        }
    }
}
