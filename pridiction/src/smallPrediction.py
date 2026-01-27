class linearRegression :
    def init (self, learningRate=0.001,epochs=1000):
        self.learningRate = learningRate
        self.epochs = epochs

        self.m=0
        self.b=0

    def fit (self, X,y):
        n = len(X)

        for _ in range (self.epoches):
            for i in range (n):
                y_output= self.m * X[i] + self.b
                error = y_output - y[i]

                self.m -= self.learningRate * error * X[i]
                self.b -= self.learningRate * error

    def smallPredict(self, X):
        return[self.m *  x +self.b for x in X ]
