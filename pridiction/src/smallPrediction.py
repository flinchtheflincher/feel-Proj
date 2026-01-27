class linearRegression:
    def __init__(self, learningRate=0.001, epochs=1000):
        self.learningRate = learningRate
        self.epochs = epochs
        self.m = 0
        self.b = 0

    def fit(self, X, y):
        n = len(X)
        if n == 0:
            return

        for _ in range(self.epochs):
            dm, db = 0.0, 0.0
            for i in range(n):
                y_pred = self.m * X[i] + self.b
                error = y_pred - y[i]
                dm += error * X[i]
                db += error
            self.m -= self.learningRate * (2 / n) * dm
            self.b -= self.learningRate * (2 / n) * db

    def smallPredict(self, X):
        return [self.m * x + self.b for x in X]
