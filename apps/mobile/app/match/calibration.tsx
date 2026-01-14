import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Dimensions, GestureResponderEvent } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMatchStore } from '../../src/stores/matchStore';
import { tennisAI } from '../../src/services/tennisAI';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type CalibrationPoint = { x: number; y: number } | null;

export default function CalibrationScreen() {
  const [step, setStep] = useState(0); // 0: 指引, 1-4: 标定四个角
  const [points, setPoints] = useState<CalibrationPoint[]>([null, null, null, null]);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraLayout, setCameraLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const cameraRef = useRef<View>(null);
  const { setCalibration } = useMatchStore();

  const cornerLabels = ['左上角', '右上角', '右下角', '左下角'];
  const cornerInstructions = [
    '点击球场左上角的边线交叉点',
    '点击球场右上角的边线交叉点',
    '点击球场右下角的边线交叉点',
    '点击球场左下角的边线交叉点',
  ];

  const handleCameraPress = (event: GestureResponderEvent) => {
    if (step === 0 || step > 4) return;

    // 使用 pageX/pageY 获取屏幕坐标，然后减去容器偏移得到相对坐标
    const { pageX, pageY } = event.nativeEvent;
    const x = pageX - cameraLayout.x;
    const y = pageY - cameraLayout.y;

    // 确保点击在相机区域内
    if (x < 0 || x > cameraLayout.width || y < 0 || y > cameraLayout.height) {
      return;
    }

    const newPoints = [...points];
    newPoints[step - 1] = { x, y };
    setPoints(newPoints);

    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleCameraLayout = useCallback(() => {
    // 使用 setTimeout 确保在布局完成后测量
    setTimeout(() => {
      if (cameraRef.current) {
        cameraRef.current.measure((fx: number, fy: number, fwidth: number, fheight: number, pageX: number, pageY: number) => {
          if (pageX !== undefined && pageY !== undefined) {
            setCameraLayout({ x: pageX, y: pageY, width: fwidth, height: fheight });
          }
        });
      }
    }, 100);
  }, []);

  const handleReset = () => {
    setPoints([null, null, null, null]);
    setStep(1);
  };

  const handleStartMatch = () => {
    // 保存校准数据
    const validPoints = points.filter(p => p !== null) as { x: number; y: number }[];
    if (setCalibration) {
      setCalibration(validPoints);
    }
    // 设置到 tennisAI 用于坐标转换
    tennisAI.setCalibration(validPoints);
    router.replace('/match/playing');
  };

  const allPointsMarked = points.every((p) => p !== null);

  // 架设指引页面
  if (step === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.guideContainer}>
          <View style={styles.guideImage}>
            <Text style={styles.phoneIcon}>📱</Text>
            <View style={styles.courtDiagram}>
              <View style={styles.courtLine} />
              <Text style={styles.courtLabel}>球场</Text>
            </View>
            <View style={styles.positionArrow}>
              <Text style={styles.arrowText}>↑</Text>
              <Text style={styles.distanceText}>3-5米</Text>
            </View>
          </View>

          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>最佳架设位置：</Text>
            <View style={styles.tipItem}>
              <Text style={styles.tipCheck}>✓</Text>
              <Text style={styles.tipText}>底线后方中央 3-5 米</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipCheck}>✓</Text>
              <Text style={styles.tipText}>高度 2-3 米（三脚架或围栏）</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipCheck}>✓</Text>
              <Text style={styles.tipText}>能看到完整球场和所有边线</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipCheck}>✓</Text>
              <Text style={styles.tipText}>避免逆光，阳光在身后最佳</Text>
            </View>
          </View>

          <View style={styles.hintBox}>
            <Text style={styles.hintIcon}>💡</Text>
            <Text style={styles.hintText}>
              小贴士：用手机支架固定在球场围栏上，既稳定又能获得不错的视角
            </Text>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.nextButton} onPress={() => setStep(1)}>
            <Text style={styles.nextButtonText}>下一步：校准球场</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 权限检查
  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>正在请求相机权限...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>需要相机权限</Text>
          <Text style={styles.permissionText}>
            球场校准需要使用相机来识别球场边线
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>授予权限</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 校准页面
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 相机预览区域 */}
      <View
        ref={cameraRef}
        style={styles.cameraPreview}
        onLayout={handleCameraLayout}
      >
        {/* 相机视图 */}
        <CameraView style={styles.camera} facing="back" />

        {/* 触摸和覆盖层 - 使用绝对定位覆盖在相机上 */}
        <Pressable style={styles.cameraOverlayTouchable} onPress={handleCameraPress}>
          <View style={styles.courtOverlay}>
            {/* 网格参考线 */}
            <View style={styles.gridContainer}>
              <View style={[styles.gridLine, styles.gridLineVertical, { left: '25%' }]} />
              <View style={[styles.gridLine, styles.gridLineVertical, { left: '50%' }]} />
              <View style={[styles.gridLine, styles.gridLineVertical, { left: '75%' }]} />
              <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '25%' }]} />
              <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '50%' }]} />
              <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '75%' }]} />
            </View>

            {/* 标记点 */}
            {points.map((point, index) =>
              point ? (
                <View
                  key={index}
                  style={[
                    styles.markedPoint,
                    { left: point.x - 15, top: point.y - 15 },
                  ]}
                >
                  <Text style={styles.markedPointNumber}>{index + 1}</Text>
                </View>
              ) : null
            )}

            {/* 连接线 */}
            {allPointsMarked && (
              <View style={styles.courtOutlineConnected}>
                {/* 这里可以用 SVG 画线，暂时用简化方式 */}
              </View>
            )}

            {/* 提示文字 */}
            {!allPointsMarked && step <= 4 && (
              <View style={styles.instructionOverlay}>
                <View style={styles.instructionBadge}>
                  <Text style={styles.instructionBadgeText}>{step}/4</Text>
                </View>
                <Text style={styles.instructionText}>
                  {cornerInstructions[step - 1]}
                </Text>
              </View>
            )}

            {/* 完成提示 */}
            {allPointsMarked && (
              <View style={styles.completedOverlay}>
                <Text style={styles.completedIcon}>✓</Text>
                <Text style={styles.completedText}>校准完成</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* 状态指示 */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>请依次点击球场的四个角：</Text>
        <View style={styles.cornerList}>
          {cornerLabels.map((label, index) => (
            <View key={index} style={styles.cornerItem}>
              <View
                style={[
                  styles.cornerStatus,
                  points[index] && styles.cornerStatusDone,
                  step - 1 === index && !points[index] && styles.cornerStatusActive,
                ]}
              >
                {points[index] ? (
                  <Text style={styles.cornerStatusCheck}>✓</Text>
                ) : step - 1 === index ? (
                  <Text style={styles.cornerStatusDot}>●</Text>
                ) : (
                  <Text style={styles.cornerStatusNumber}>{index + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.cornerLabel,
                  points[index] && styles.cornerLabelDone,
                  step - 1 === index && !points[index] && styles.cornerLabelActive,
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>↻ 重新标记</Text>
        </TouchableOpacity>
      </View>

      {/* 底部按钮 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.nextButton, !allPointsMarked && styles.nextButtonDisabled]}
          onPress={handleStartMatch}
          disabled={!allPointsMarked}
        >
          <Text style={styles.nextButtonText}>
            {allPointsMarked ? '开始比赛！' : '请完成校准'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  // 权限页面
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  permissionText: {
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // 指引页面样式
  guideContainer: {
    flex: 1,
    padding: 20,
  },
  guideImage: {
    backgroundColor: '#374151',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  phoneIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  courtDiagram: {
    width: 200,
    height: 120,
    borderWidth: 2,
    borderColor: '#6B7280',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courtLine: {
    position: 'absolute',
    top: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#6B7280',
  },
  courtLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  positionArrow: {
    alignItems: 'center',
    marginTop: 10,
  },
  arrowText: {
    color: '#10B981',
    fontSize: 24,
  },
  distanceText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  tipsContainer: {
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  tipsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipCheck: {
    color: '#10B981',
    fontSize: 16,
    marginRight: 10,
    fontWeight: '600',
  },
  tipText: {
    color: '#D1D5DB',
    fontSize: 14,
    flex: 1,
  },
  hintBox: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
  },
  hintIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  hintText: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  // 校准页面样式
  cameraPreview: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  courtOverlay: {
    flex: 1,
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  gridLineVertical: {
    width: 1,
    height: '100%',
  },
  gridLineHorizontal: {
    width: '100%',
    height: 1,
  },
  markedPoint: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markedPointNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  courtOutlineConnected: {
    ...StyleSheet.absoluteFillObject,
  },
  instructionOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionBadge: {
    backgroundColor: '#10B981',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  completedOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  completedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    padding: 20,
    backgroundColor: '#1F2937',
  },
  statusTitle: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 15,
  },
  cornerList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cornerItem: {
    alignItems: 'center',
  },
  cornerStatus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#374151',
  },
  cornerStatusDone: {
    backgroundColor: '#10B981',
  },
  cornerStatusActive: {
    backgroundColor: '#F59E0B',
  },
  cornerStatusCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cornerStatusDot: {
    color: '#fff',
    fontSize: 12,
  },
  cornerStatusNumber: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  cornerLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  cornerLabelDone: {
    color: '#10B981',
  },
  cornerLabelActive: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 15,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
  // 通用底部栏
  bottomBar: {
    padding: 20,
    backgroundColor: '#1F2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  nextButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#374151',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
