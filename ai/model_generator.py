import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models

def build_fusion_model():
    # Branch 1: CNN Image Feature Extractor
    # Expected input shape: (224, 224, 3), range [0, 1] or [-1, 1]
    image_input = layers.Input(shape=(224, 224, 3), name='image_input')
    
    # We use MobileNetV3Small headless for efficiency and sub-second inference.
    # weights=None enables offline compilation and avoids downloading issues.
    base_model = tf.keras.applications.MobileNetV3Small(
        input_shape=(224, 224, 3),
        include_top=False,
        weights=None,
        pooling='avg'
    )
    
    cnn_features = base_model(image_input)
    cnn_embedding = layers.Dense(64, activation='relu', name='cnn_embedding')(cnn_features)
    
    # Branch 2: Dense Geometric Ratios
    # Expected input shape: 9 clinical facial ratios
    geo_input = layers.Input(shape=(9,), name='geo_input')
    y = layers.Dense(32, activation='relu')(geo_input)
    y = layers.Dense(64, activation='relu')(y)
    geo_embedding = layers.Dense(64, activation='relu', name='geo_embedding')(y)
    
    # Fusion Layer (Concatenate both embeddings)
    fused = layers.concatenate([cnn_embedding, geo_embedding])
    
    # Classification Head
    z = layers.Dense(64, activation='relu')(fused)
    z = layers.Dropout(0.3)(z)
    output = layers.Dense(3, activation='softmax', name='risk_output')(z)
    
    model = models.Model(inputs=[image_input, geo_input], outputs=output)
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

def augment_images(images):
    # Perform manual numpy-based data augmentation to keep TFLite conversion clean of custom TF ops
    augmented = []
    for img in images:
        # Random horizontal flip
        if np.random.rand() > 0.5:
            img = np.fliplr(img)
        # Random brightness shift
        brightness_factor = np.random.uniform(0.8, 1.2)
        img = np.clip(img * brightness_factor, 0.0, 1.0)
        # Random noise injection
        if np.random.rand() > 0.5:
            noise = np.random.normal(0, 0.02, img.shape)
            img = np.clip(img + noise, 0.0, 1.0)
        augmented.append(img)
    return np.array(augmented)

def main():
    print("TensorFlow Version:", tf.__version__)
    print("Generating simulated data for training...")
    
    # Generate 200 simulated samples
    num_samples = 200
    X_img = np.random.rand(num_samples, 224, 224, 3).astype(np.float32)
    # Augment simulated images
    X_img = augment_images(X_img)
    
    # Generate 9 clinical face ratios:
    # 0: Inter-ocular distance ratio
    # 1: Cheek hollowness index
    # 2: Temple depression score
    # 3: Jaw prominence
    # 4: Cheekbone prominence
    # 5: Temple width
    # 6: Facial width ratio
    # 7: Jaw width ratio
    # 8: Facial symmetry
    X_geo = np.random.rand(num_samples, 9).astype(np.float32)
    
    # Generate labels (0: Normal, 1: Moderate Risk, 2: High Risk)
    y = np.random.choice([0, 1, 2], size=(num_samples,)).astype(np.int32)
    
    print("Building model...")
    model = build_fusion_model()
    model.summary()
    
    print("Training model (epochs=5 to initialize weights)...")
    model.fit([X_img, X_geo], y, epochs=5, batch_size=16)
    
    # Save base model
    keras_path = 'model.h5'
    model.save(keras_path)
    print(f"Keras model saved to {keras_path}")
    
    # Convert to TFLite
    print("Converting to TFLite with Dynamic Range Quantization...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    
    tflite_path = 'model.tflite'
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
        
    print(f"TFLite model successfully written to {tflite_path}")
    print(f"Model file size: {os.path.getsize(tflite_path) / (1024 * 1024):.2f} MB")

if __name__ == '__main__':
    main()
