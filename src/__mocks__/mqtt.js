// web-ui/src/__mocks__/mqtt.js

const mockClient = {
    on: jest.fn((event, callback) => {
        // Instantly trigger 'connect' event in test environment
        if (event === "connect") {
            setTimeout(() => callback(), 0)
        }
        return mockClient
    }),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn(),
    end: jest.fn(),
}

const mqtt = {
    connect: jest.fn(() => mockClient),
}

export default mqtt