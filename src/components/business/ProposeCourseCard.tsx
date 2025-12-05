import React, { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';

interface ProposeCourseCardProps {
  className?: string;
  mode?: 'grid' | 'list';
}

const ProposeCourseCard: React.FC<ProposeCourseCardProps> = ({ className, mode = 'grid' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    courseName: '',
    description: '',
    contact: ''
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const title = '新课程需求';
    const body = `
课程名称：${formData.courseName}
需求描述：${formData.description}
联系方式：${formData.contact}
`.trim();

    const githubIssueUrl = `https://github.com/KWDB/playground/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    
    window.open(githubIssueUrl, '_blank');
    handleCloseModal();
  };

  return (
    <>
      {mode === 'grid' ? (
        <div 
          onClick={handleOpenModal}
          className={`group relative flex flex-col h-full bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-300 ${className}`}
        >
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 flex items-center justify-center transition-colors duration-300">
              <PlusCircle className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors duration-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                提议新课程
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 group-hover:text-indigo-600/80 dark:group-hover:text-indigo-400/80">
                希望有更多课程？<br/>告诉我们你想学什么
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div 
          onClick={handleOpenModal}
          className={`group block bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-4 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all duration-200 ${className}`}
        >
          <div className="flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            <PlusCircle className="w-5 h-5" />
            <span className="font-medium">提议新课程</span>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                提议新课程
              </h3>
              <button 
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="courseName" className="block text-sm font-medium text-gray-700 mb-1">
                  课程名称
                </label>
                <input
                  type="text"
                  id="courseName"
                  name="courseName"
                  required
                  value={formData.courseName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="例如：KWDB 高级查询优化"
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  需求描述
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  placeholder="请简要描述您希望学习的内容..."
                />
              </div>
              
              <div>
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                  联系方式 (可选)
                </label>
                <input
                  type="text"
                  id="contact"
                  name="contact"
                  value={formData.contact}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="邮箱或微信号"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors shadow-lg shadow-blue-600/20"
                >
                  提交反馈
                </button>
                <p className="text-xs text-center text-gray-400 mt-3">
                  点击后将跳转至 GitHub Issue 页面，内容会自动填充到 Issue 中。
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ProposeCourseCard;
