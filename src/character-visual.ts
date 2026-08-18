import * as THREE from 'three';

export type CharacterArchetype='normal'|'heavy'|'runner'|'knight'|'ranged'|'boss';
export type EquipmentType='sword'|'shield'|'spear'|'staff'|'none';

export type CharacterDefinition={
  archetype:CharacterArchetype;
  headScale:number;
  bodyScale:THREE.Vector3;
  armScale:number;
  legScale:number;
  height:number;
  width:number;
  equipment:EquipmentType;
  primaryColor:number;
  secondaryColor:number;
  accentColor:number;
};

export type CharacterPose={
  x:number;
  z:number;
  facing:number;
  moving:boolean;
  spawn:number;
  attack:number;
  hit:number;
  phase:number;
};

type DeathPose=CharacterPose&{life:number;vx:number;vz:number};
type Part={node:THREE.Object3D;mesh:THREE.InstancedMesh;outline?:THREE.InstancedMesh;color:'primary'|'secondary'|'skin'|'dark'|'metal'|'accent'};

export const NORMAL_CHARACTER:CharacterDefinition={
  archetype:'normal',headScale:1.12,bodyScale:new THREE.Vector3(1.03,.95,.86),armScale:1.04,legScale:1.02,
  height:1.16,width:1.1,equipment:'sword',primaryColor:0x4f8dff,secondaryColor:0x245bd6,accentColor:0x9cffff
};

function toonGradient(){
  const data=new Uint8Array([55,55,55,145,145,145,215,215,215,255,255,255]);
  const texture=new THREE.DataTexture(data,4,1,THREE.RedFormat);
  texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
  return texture;
}

function toonMaterial(color:number,gradient:THREE.Texture,emissive=0){
  return new THREE.MeshToonMaterial({color,gradientMap:gradient,emissive,emissiveIntensity:emissive?0.68:0});
}

export class ProceduralCharacterRenderer{
  private readonly root=new THREE.Object3D();
  private readonly body=new THREE.Object3D();
  private readonly head=new THREE.Object3D();
  private readonly leftArmPivot=new THREE.Object3D();
  private readonly rightArmPivot=new THREE.Object3D();
  private readonly leftLegPivot=new THREE.Object3D();
  private readonly rightLegPivot=new THREE.Object3D();
  private readonly equipmentRoot=new THREE.Object3D();
  private readonly trailNode=new THREE.Object3D();
  private readonly parts:Part[]=[];
  private readonly shadow:THREE.InstancedMesh;
  private readonly swordTrail:THREE.InstancedMesh;
  private readonly colors:Record<Part['color'],THREE.Color>;
  private readonly white=new THREE.Color(0xffffff);
  private readonly deaths:DeathPose[]=[];
  private readonly shadowDummy=new THREE.Object3D();
  private readonly outlineMatrix=new THREE.Matrix4();
  private readonly outlineScale=new THREE.Vector3(1.065,1.065,1.065);
  private visible=true;

  constructor(scene:THREE.Object3D,private readonly maxCount:number,private readonly definition:CharacterDefinition){
    const gradient=toonGradient();
    const materials={
      primary:toonMaterial(definition.primaryColor,gradient,0x071a55),secondary:toonMaterial(definition.secondaryColor,gradient),
      skin:toonMaterial(0xf5c7a4,gradient),dark:toonMaterial(0x10172c,gradient),metal:toonMaterial(0xdbe8ff,gradient),
      accent:toonMaterial(definition.accentColor,gradient,definition.accentColor)
    };
    this.colors={primary:new THREE.Color(definition.primaryColor),secondary:new THREE.Color(definition.secondaryColor),skin:new THREE.Color(0xf5c7a4),dark:new THREE.Color(0x10172c),metal:new THREE.Color(0xdbe8ff),accent:new THREE.Color(definition.accentColor)};
    this.root.add(this.body,this.head,this.leftArmPivot,this.rightArmPivot,this.leftLegPivot,this.rightLegPivot);
    this.rightArmPivot.add(this.equipmentRoot);this.equipmentRoot.add(this.trailNode);
    const add=(node:THREE.Object3D,geometry:THREE.BufferGeometry,color:Part['color'],outline=false)=>{
      const mesh=new THREE.InstancedMesh(geometry,materials[color],maxCount);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;
      let outlineMesh:THREE.InstancedMesh|undefined;
      if(outline){outlineMesh=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:0x081126,side:THREE.BackSide}),maxCount);outlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);outlineMesh.frustumCulled=false;scene.add(outlineMesh)}
      scene.add(mesh);this.parts.push({node,mesh,outline:outlineMesh,color});
    };
    add(this.body,new THREE.CapsuleGeometry(.29,.38,4,8),'primary',true);
    const belt=new THREE.Object3D();belt.position.y=-.14;this.body.add(belt);add(belt,new THREE.CylinderGeometry(.31,.31,.11,10),'dark');
    const chest=new THREE.Object3D();chest.position.set(0,.12,.255);this.body.add(chest);add(chest,new THREE.BoxGeometry(.39,.2,.08),'secondary');
    add(this.head,new THREE.SphereGeometry(.285,10,7),'skin',true);
    const helmet=new THREE.Object3D();helmet.position.y=.085;this.head.add(helmet);add(helmet,new THREE.SphereGeometry(.31,10,7,0,Math.PI*2,0,Math.PI*.58),'primary',true);
    const brim=new THREE.Object3D();brim.position.set(0,.03,.03);this.head.add(brim);add(brim,new THREE.CylinderGeometry(.345,.345,.075,10),'secondary');
    const visor=new THREE.Object3D();visor.position.set(0,-.005,.272);this.head.add(visor);add(visor,new THREE.BoxGeometry(.31,.075,.055),'dark');
    this.makeArm(this.leftArmPivot,-1,add);this.makeArm(this.rightArmPivot,1,add);
    this.makeLeg(this.leftLegPivot,-1,add);this.makeLeg(this.rightLegPivot,1,add);
    if(definition.equipment==='sword'){
      const guard=new THREE.Object3D();guard.position.set(0,-.51,.11);this.equipmentRoot.add(guard);add(guard,new THREE.BoxGeometry(.31,.07,.08),'accent');
      const blade=new THREE.Object3D();blade.position.set(0,-.73,.16);blade.rotation.x=-.18;this.equipmentRoot.add(blade);add(blade,new THREE.BoxGeometry(.075,.52,.075),'metal',true);
    }
    this.shadow=new THREE.InstancedMesh(new THREE.CircleGeometry(.38,14),new THREE.MeshBasicMaterial({color:0x071020,transparent:true,opacity:.28,depthWrite:false}),maxCount);
    this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.shadow.frustumCulled=false;scene.add(this.shadow);
    this.swordTrail=new THREE.InstancedMesh(new THREE.TorusGeometry(.46,.055,4,18,Math.PI*.86),new THREE.MeshBasicMaterial({color:0x8defff,transparent:true,opacity:.78,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),maxCount);
    this.swordTrail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.swordTrail.frustumCulled=false;scene.add(this.swordTrail);
  }

  private makeArm(pivot:THREE.Object3D,side:number,add:(node:THREE.Object3D,geometry:THREE.BufferGeometry,color:Part['color'],outline?:boolean)=>void){
    pivot.position.set(side*.32,.17,0);const arm=new THREE.Object3D();arm.position.y=-.2;arm.scale.setScalar(this.definition.armScale);pivot.add(arm);add(arm,new THREE.CapsuleGeometry(.095,.24,3,6),'secondary');
    const hand=new THREE.Object3D();hand.position.y=-.44;pivot.add(hand);add(hand,new THREE.SphereGeometry(.115,7,5),'skin');
  }

  private makeLeg(pivot:THREE.Object3D,side:number,add:(node:THREE.Object3D,geometry:THREE.BufferGeometry,color:Part['color'],outline?:boolean)=>void){
    pivot.position.set(side*.14,-.31,0);const leg=new THREE.Object3D();leg.position.y=-.19;leg.scale.setScalar(this.definition.legScale);pivot.add(leg);add(leg,new THREE.CapsuleGeometry(.105,.2,3,6),'dark');
    const foot=new THREE.Object3D();foot.position.set(0,-.4,.085);pivot.add(foot);add(foot,new THREE.BoxGeometry(.19,.13,.3),'secondary');
  }

  setVisible(visible:boolean){this.visible=visible;for(const p of this.parts){p.mesh.visible=visible;if(p.outline)p.outline.visible=visible}this.shadow.visible=visible;this.swordTrail.visible=visible}

  spawnDeath(pose:CharacterPose){if(!this.visible)return;if(this.deaths.length>=32)this.deaths.shift();this.deaths.push({...pose,life:.58,vx:-Math.sin(pose.facing)*1.4,vz:-Math.cos(pose.facing)*1.4})}

  sync(poses:CharacterPose[],poseCount:number,time:number,dt:number){
    for(let i=this.deaths.length-1;i>=0;i--){const d=this.deaths[i];d.life-=dt;d.x+=d.vx*dt;d.z+=d.vz*dt;if(d.life<=0)this.deaths.splice(i,1)}
    const total=Math.min(this.maxCount,poseCount+this.deaths.length);
    let trailCount=0;
    for(let i=0;i<total;i++){
      const deathPose=i>=poseCount?this.deaths[i-poseCount]:null,pose=deathPose??poses[i],death=deathPose?1-deathPose.life/.58:0;
      const speed=pose.moving?1:0,run=Math.sin(time*10.5+pose.phase)*speed,bounce=speed*Math.abs(Math.sin(time*10.5+pose.phase))*.065+Math.sin(time*2.4+pose.phase)*.012;
      const attackT=pose.attack>0?1-pose.attack/.18:0,attack=Math.sin(Math.max(0,Math.min(1,attackT))*Math.PI),hit=Math.min(1,pose.hit*7);
      const spawnScale=pose.spawn>0?.75+Math.sin((.5-pose.spawn)/.5*Math.PI)*.25:1,deathScale=1-death*.46;
      this.root.position.set(pose.x-Math.sin(pose.facing)*hit*.18,.92+bounce+death*.08,pose.z-Math.cos(pose.facing)*hit*.18);
      this.root.rotation.set(-.08*speed,pose.facing,death*1.2);const baseScale=spawnScale*deathScale;this.root.scale.set(this.definition.width*baseScale,this.definition.height*baseScale,this.definition.width*baseScale);
      this.body.scale.copy(this.definition.bodyScale);this.body.rotation.z=Math.sin(time*2.4+pose.phase)*.025;
      this.head.position.set(0,.48,0);this.head.scale.setScalar(this.definition.headScale);this.head.rotation.y=Math.sin(time*1.7+pose.phase)*.045;
      this.leftArmPivot.rotation.set(run*.72,0,-.08);this.rightArmPivot.rotation.set(-run*.72-attack*1.72,0,.08+attack*.48);
      this.leftLegPivot.rotation.set(-run*.68,0,0);this.rightLegPivot.rotation.set(run*.68,0,0);
      this.equipmentRoot.rotation.set(-attack*.45,0,attack*.25);this.trailNode.position.set(0,-.5,.14);
      this.root.updateMatrixWorld(true);
      for(const part of this.parts){part.mesh.setMatrixAt(i,part.node.matrixWorld);part.mesh.setColorAt(i,pose.hit>0?this.white:this.colors[part.color]);if(part.outline){this.outlineMatrix.copy(part.node.matrixWorld).scale(this.outlineScale);part.outline.setMatrixAt(i,this.outlineMatrix)}}
      this.shadowDummy.position.set(pose.x,.015,pose.z);this.shadowDummy.rotation.set(-Math.PI/2,0,0);this.shadowDummy.scale.set(1-death*.5,.62-death*.3,1);this.shadowDummy.updateMatrix();this.shadow.setMatrixAt(i,this.shadowDummy.matrix);
      if(pose.attack>0&&!death){const trailDummy=new THREE.Object3D();trailDummy.position.set(pose.x+Math.sin(pose.facing)*.33,1.04,pose.z+Math.cos(pose.facing)*.33);trailDummy.rotation.set(Math.PI/2,pose.facing,-.65+attackT*1.3);trailDummy.scale.setScalar(.8+attack*.25);trailDummy.updateMatrix();this.swordTrail.setMatrixAt(trailCount++,trailDummy.matrix)}
    }
    for(const part of this.parts){part.mesh.count=total;part.mesh.instanceMatrix.needsUpdate=true;if(part.mesh.instanceColor)part.mesh.instanceColor.needsUpdate=true;if(part.outline){part.outline.count=total;part.outline.instanceMatrix.needsUpdate=true}}
    this.shadow.count=total;this.shadow.instanceMatrix.needsUpdate=true;this.swordTrail.count=trailCount;this.swordTrail.instanceMatrix.needsUpdate=true;
  }
}

